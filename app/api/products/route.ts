import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requireSession, requirePermission, withErrorHandler } from '@/lib/permissions'
import Product from '@/models/Product'
import ProductWarehouse from '@/models/ProductWarehouse'
import Warehouse from '@/models/Warehouse'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { productSchema } from '@/lib/validation'
import { nextNumericCode } from '@/lib/references'
import { fromBaseQty, round4 } from '@/lib/calculations'
import { hasDocumentReference, validateProductReferences } from '@/lib/resource-integrity'

const SORT_FIELDS = new Set(['createdAt', 'name', 'code', 'cost', 'price'])

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'products_view')
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search, sortBy, sortDir } = parsePagination(url)
  const warehouseId = url.searchParams.get('warehouse_id')
  const categoryId = url.searchParams.get('category_id')
  const brandId = url.searchParams.get('brand_id')
  const stockUnit = url.searchParams.get('stock_unit') ?? 'base'
  if (warehouseId && !mongoose.Types.ObjectId.isValid(warehouseId)) throw new ApiError(422, 'Invalid warehouse')

  const barcode = url.searchParams.get('barcode')
  const lowStock = url.searchParams.get('low_stock') === 'true'

  const filter: any = { deletedAt: null }

  // Exact barcode lookup — used by POS scanner and barcode print page
  if (barcode) {
    filter.$or = [
      { code: barcode.trim() },
      { 'variants.code': barcode.trim() },
    ]
  } else {
    const searchPattern = escapeRegex(search)
    if (searchPattern) filter.$or = [
      { name: { $regex: searchPattern, $options: 'i' } },
      { code: { $regex: searchPattern, $options: 'i' } },
      { 'variants.code': { $regex: searchPattern, $options: 'i' } },
    ]
  }
  if (categoryId) filter.category_id = categoryId
  if (brandId) filter.brand_id = brandId
  // Low-stock filter: only products with alert enabled (stock check done below)
  if (lowStock) filter.has_alert = true

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category_id brand_id', 'name')
      .populate('unit_id sale_unit_id purchase_unit_id', 'name short_name operator operator_value base_unit')
      .sort({ [SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt']: sortDir as any })
      .skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ])
  const productIds = products.map((product: any) => product._id)
  const stockMatch: Record<string, unknown> = { product_id: { $in: productIds }, deletedAt: null }
  if (warehouseId) stockMatch.warehouse_id = new mongoose.Types.ObjectId(warehouseId)
  const stockRows = await ProductWarehouse.aggregate([
    { $match: stockMatch },
    { $group: { _id: '$product_id', total_qte: { $sum: '$qte' }, variants: { $push: { variant_id: '$variant_id', qte: '$qte', warehouse_id: '$warehouse_id' } } } },
  ])
  const stockMap = new Map(stockRows.map((row: any) => [row._id.toString(), row]))
  const data = products.map((product: any) => {
    const stock = stockMap.get(product._id.toString()) as any
    const baseStock = stock?.total_qte ?? 0
    const unit = stockUnit === 'sale' ? product.sale_unit_id : stockUnit === 'purchase' ? product.purchase_unit_id : null
    const currentStock = unit ? fromBaseQty(baseStock, unit) : baseStock
    return {
      ...product,
      current_stock: round4(currentStock),
      current_stock_base: round4(baseStock),
      stock_variants: (stock?.variants ?? []).map((row: any) => ({
        ...row,
        current_stock_base: round4(row.qte),
        current_stock: round4(unit ? fromBaseQty(row.qte, unit) : row.qte),
      })),
    }
  })
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'products_add')
  await dbConnect()
  const body = productSchema.parse(await req.json())
  const session = await startTransactionSession()
  try {
    let code = body.code?.trim()
    if (!code) {
      const variantCodes = new Set((body.variants || []).map((v: any) => v.code?.trim()).filter(Boolean))
      do {
        code = await nextNumericCode('product', session)
      } while (
        variantCodes.has(code) ||
        await Product.exists({ $or: [{ code }, { 'variants.code': code }], deletedAt: null }).session(session)
      )
    }
    await validateProductReferences({ ...body, code }, session)
    const [product] = await Product.create([{ ...body, code }], { session })
    const warehouses = await Warehouse.find({ deletedAt: null }).select('_id').session(session)
    const stockDocs = warehouses.flatMap((warehouse) => product.is_variant
      ? product.variants.filter((variant: any) => !variant.deletedAt).map((variant: any) => ({ product_id: product._id, warehouse_id: warehouse._id, variant_id: variant._id, qte: 0 }))
      : [{ product_id: product._id, warehouse_id: warehouse._id, variant_id: null, qte: 0 }])
    if (stockDocs.length) await ProductWarehouse.insertMany(stockDocs, { session })
    await session.commitTransaction()
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'products_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)
  const session = await startTransactionSession()
  try {
    const nonZero = await ProductWarehouse.exists({ product_id: { $in: ids }, deletedAt: null, qte: { $ne: 0 } }).session(session)
    if (nonZero) throw new ApiError(409, 'Products with stock cannot be deleted')
    if (await hasDocumentReference('details.product_id', ids, session)) throw new ApiError(409, 'Products referenced by documents cannot be deleted')
    await Product.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } }, { session })
    await ProductWarehouse.updateMany({ product_id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } }, { session })
    await session.commitTransaction()
    return NextResponse.json({ message: `${ids.length} products deleted`, count: ids.length })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

