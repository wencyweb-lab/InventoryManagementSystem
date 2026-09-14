import type { ClientSession } from 'mongoose'
import ProductWarehouse from '@/models/ProductWarehouse'
import Product from '@/models/Product'
import Unit from '@/models/Unit'
import Warehouse from '@/models/Warehouse'
import Client from '@/models/Client'
import Provider from '@/models/Provider'
import { ApiError } from '@/lib/permissions'
import { round4, toBaseQty } from '@/lib/calculations'

export type StockLine = {
  product_id: unknown
  variant_id?: unknown | null
  unit_id?: unknown | null
  quantity: number
}

function stockFilter(line: StockLine, warehouseId: unknown) {
  return {
    product_id: line.product_id,
    warehouse_id: warehouseId,
    variant_id: line.variant_id ?? null,
    deletedAt: null,
  }
}

export async function baseQuantity(line: StockLine, session: ClientSession | null = null): Promise<number> {
  const product = await Product.findOne({ _id: line.product_id, deletedAt: null }).session(session)
  if (!product) throw new ApiError(422, 'A line references a product that does not exist')

  if (product.is_variant) {
    const variant = product.variants.find(
      (item: any) => item._id.toString() === line.variant_id?.toString() && !item.deletedAt
    )
    if (!variant) throw new ApiError(422, `Product ${product.name} requires a valid active variant`)
  } else if (line.variant_id) {
    throw new ApiError(422, `Product ${product.name} does not accept a variant`)
  }

  if (!Number.isFinite(line.quantity) || round4(line.quantity) <= 0) throw new ApiError(422, 'Quantity must be at least 0.0001 base units')
  if (!line.unit_id) return round4(line.quantity)
  const unit = await Unit.findOne({ _id: line.unit_id, deletedAt: null }).session(session)
  if (!unit) throw new ApiError(422, `The unit for ${product.name} does not exist`)

  const productBase = product.unit_id?.toString()
  const unitBase = unit.base_unit?.toString() ?? unit._id.toString()
  if (productBase && unitBase !== productBase) {
    throw new ApiError(422, `The selected unit is not compatible with ${product.name}`)
  }

  const quantity = round4(toBaseQty(line.quantity, unit))
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(422, 'Converted quantity must be finite and at least 0.0001 base units')
  return quantity
}

export async function validateDocumentReferences(document: any, session: ClientSession | null = null) {
  const warehouses = [document.warehouse_id, document.from_warehouse_id, document.to_warehouse_id].filter(Boolean)
  for (const id of warehouses) {
    if (!await Warehouse.exists({ _id: id, deletedAt: null }).session(session)) throw new ApiError(422, 'Warehouse does not exist')
  }
  if (document.client_id && !await Client.exists({ _id: document.client_id, deletedAt: null }).session(session)) throw new ApiError(422, 'Customer does not exist')
  if (document.provider_id && !await Provider.exists({ _id: document.provider_id, deletedAt: null }).session(session)) throw new ApiError(422, 'Supplier does not exist')
  for (const line of document.details) await baseQuantity(line, session)
}

export async function changeStock(
  line: StockLine,
  warehouseId: unknown,
  delta: number,
  session: ClientSession
) {
  if (!Number.isFinite(delta)) throw new ApiError(422, 'Stock change must be finite')
  if (delta === 0) return
  const filter = stockFilter(line, warehouseId)
  const guardedFilter = delta < 0
    ? { ...filter, qte: { $gte: round4(Math.abs(delta)) } }
    : filter

  const updated = await ProductWarehouse.findOneAndUpdate(
    guardedFilter,
    { $inc: { qte: round4(delta) } },
    { new: true, session }
  )
  if (updated) return updated

  const existing = await ProductWarehouse.findOne(filter).session(session)
  if (!existing) {
    throw new ApiError(409, 'Stock row is missing for a product, warehouse, or variant')
  }
  throw new ApiError(409, 'Insufficient stock for this operation')
}

export async function applyLines(
  lines: StockLine[],
  warehouseId: unknown,
  sign: 1 | -1,
  session: ClientSession
) {
  for (const line of lines) {
    const quantity = await baseQuantity(line, session)
    await changeStock(line, warehouseId, sign * quantity, session)
  }
}
