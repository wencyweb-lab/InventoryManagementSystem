import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, ApiError } from '@/lib/permissions'
import Product from '@/models/Product'
import ProductWarehouse from '@/models/ProductWarehouse'
import Warehouse from '@/models/Warehouse'
import { productSchema } from '@/lib/validation'
import { hasDocumentReference, validateProductReferences } from '@/lib/resource-integrity'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'products_view')
  await dbConnect()
  const product = await Product.findOne({ _id: ctx.params.id, deletedAt: null })
    .populate('category_id brand_id', 'name')
    .populate('unit_id sale_unit_id purchase_unit_id', 'name short_name operator operator_value base_unit')
  if (!product) throw new ApiError(404, 'Product not found')
  const stock = await ProductWarehouse.find({ product_id: product._id, deletedAt: null }).populate('warehouse_id', 'name')
  return NextResponse.json({ product, stock })
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'products_edit')
  await dbConnect()
  const body = productSchema.parse(await req.json())
  const session = await startTransactionSession()
  try {
    const product = await Product.findOne({ _id: ctx.params.id, deletedAt: null }).session(session)
    if (!product) throw new ApiError(404, 'Product not found')

    const incomingCode = body.code?.trim() || product.code
    await validateProductReferences({ ...body, code: incomingCode }, session, product._id.toString())
    const identityChanged = String(product.unit_id) !== String(body.unit_id) || product.is_variant !== body.is_variant
    if (identityChanged && (await ProductWarehouse.exists({ product_id: product._id, deletedAt: null, qte: { $ne: 0 } }).session(session) || await hasDocumentReference('details.product_id', [product._id], session))) {
      throw new ApiError(409, 'Base unit and variant mode cannot change while stock or documents reference this product')
    }


    if (product.is_variant !== body.is_variant) {
      const nonZero = await ProductWarehouse.exists({ product_id: product._id, deletedAt: null, qte: { $ne: 0 } }).session(session)
      if (nonZero) throw new ApiError(409, 'Variant mode cannot change while this product has stock')
      await ProductWarehouse.updateMany({ product_id: product._id, deletedAt: null }, { deletedAt: new Date() }, { session })
    }

    const existingIds = new Set<string>(product.variants.filter((item: any) => !item.deletedAt).map((item: any) => item._id.toString()))
    const incomingIds = new Set<string>(body.variants.flatMap((item) => item._id ? [item._id] : []))
    if (incomingIds.size !== body.variants.filter(item => item._id).length || [...incomingIds].some(id => !existingIds.has(id))) throw new ApiError(422, 'Variant identifiers must be unique and belong to this product')
    const removedIds = [...existingIds].filter((id) => !incomingIds.has(id))
    if (removedIds.length) {
      if (await hasDocumentReference('details.variant_id', removedIds, session)) throw new ApiError(409, 'A variant referenced by documents cannot be removed')
      const nonZero = await ProductWarehouse.exists({ product_id: product._id, variant_id: { $in: removedIds }, deletedAt: null, qte: { $ne: 0 } }).session(session)
      if (nonZero) throw new ApiError(409, 'A variant with stock cannot be removed')
      await ProductWarehouse.updateMany({ product_id: product._id, variant_id: { $in: removedIds }, deletedAt: null }, { deletedAt: new Date() }, { session })
    }

    Object.assign(product, { ...body, code: body.code || product.code })
    await product.save({ session })

    const warehouses = await Warehouse.find({ deletedAt: null }).select('_id').session(session)
    const newVariants = product.variants.filter((item: any) => !item.deletedAt && !existingIds.has(item._id.toString()))
    const stockDocs = product.is_variant
      ? warehouses.flatMap((warehouse) => newVariants.map((variant: any) => ({ product_id: product._id, warehouse_id: warehouse._id, variant_id: variant._id, qte: 0 })))
      : warehouses.map((warehouse) => ({ product_id: product._id, warehouse_id: warehouse._id, variant_id: null, qte: 0 }))
    if (stockDocs.length) {
      await ProductWarehouse.bulkWrite(stockDocs.map((doc) => ({
        updateOne: {
          filter: { product_id: doc.product_id, warehouse_id: doc.warehouse_id, variant_id: doc.variant_id, deletedAt: null },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })), { session })
    }

    await session.commitTransaction()
    return NextResponse.json(product)
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'products_delete')
  await dbConnect()
  const session = await startTransactionSession()
  try {
    const product = await Product.findOne({ _id: ctx.params.id, deletedAt: null }).session(session)
    if (!product) throw new ApiError(404, 'Product not found')
    const nonZero = await ProductWarehouse.exists({ product_id: product._id, deletedAt: null, qte: { $ne: 0 } }).session(session)
    if (nonZero) throw new ApiError(409, 'A product with stock cannot be deleted')
    if (await hasDocumentReference('details.product_id', [product._id], session)) throw new ApiError(409, 'A product referenced by documents cannot be deleted')
    const now = new Date()
    product.deletedAt = now
    await product.save({ session })
    await ProductWarehouse.updateMany({ product_id: product._id, deletedAt: null }, { deletedAt: now }, { session })
    await session.commitTransaction()
    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

