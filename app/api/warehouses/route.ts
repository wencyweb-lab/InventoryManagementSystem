import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requireSession, requirePermission, withErrorHandler } from '@/lib/permissions'
import Warehouse from '@/models/Warehouse'
import ProductWarehouse from '@/models/ProductWarehouse'
import Product from '@/models/Product'
import { warehouseSchema } from '@/lib/validation'
import { hasDocumentReference } from '@/lib/resource-integrity'
import { Setting } from '@/models/Settings'
import { Expense } from '@/models/Expense'
import { escapeRegex, parsePagination } from '@/lib/utils'

export const GET = withErrorHandler(async (req: Request) => {
  await requireSession()
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const filter: any = { deletedAt: null }
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }
  if (url.searchParams.get('all') === 'true' || url.searchParams.get('unpaginated') === 'true') {
    return NextResponse.json(await Warehouse.find(filter).select('name city').sort({ name: 1 }).lean())
  }
  const [data, total] = await Promise.all([
    Warehouse.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Warehouse.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'warehouse')
  await dbConnect()
  const body = warehouseSchema.parse(await req.json())
  const session = await startTransactionSession()
  try {
    const [warehouse] = await Warehouse.create([body], { session })
    const products = await Product.find({ deletedAt: null }).session(session)
    const stockDocs = products.flatMap((product) => product.is_variant
      ? product.variants.filter((variant: any) => !variant.deletedAt).map((variant: any) => ({ product_id: product._id, warehouse_id: warehouse._id, variant_id: variant._id, qte: 0 }))
      : [{ product_id: product._id, warehouse_id: warehouse._id, variant_id: null, qte: 0 }])
    if (stockDocs.length) await ProductWarehouse.insertMany(stockDocs, { session })
    await session.commitTransaction()
    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'warehouse')
  await dbConnect()
  const ids = await parseBulkIds(req)
  const session = await startTransactionSession()
  try {
    if (await ProductWarehouse.exists({ warehouse_id: { $in: ids }, deletedAt: null, qte: { $ne: 0 } }).session(session)) throw new ApiError(409, 'Warehouses with stock cannot be deleted')
    for (const field of ['warehouse_id', 'from_warehouse_id', 'to_warehouse_id']) {
      if (await hasDocumentReference(field, ids, session)) throw new ApiError(409, 'Warehouses referenced by documents cannot be deleted')
    }
    if (await Setting.exists({ warehouse_id: { $in: ids } }).session(session) || await Expense.exists({ warehouse_id: { $in: ids }, deletedAt: null }).session(session)) throw new ApiError(409, 'Warehouse is in use by settings or expenses')
    await Warehouse.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } }, { session })
    await ProductWarehouse.updateMany({ warehouse_id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } }, { session })
    await session.commitTransaction()
    return NextResponse.json({ message: `${ids.length} warehouses deleted`, count: ids.length })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})


