import { NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { canonicalCommercialDocument } from '@/lib/validation'
import { nextReference } from '@/lib/references'
import { applySaleEffect } from '@/lib/stock-effects'
import { round2 } from '@/lib/calculations'
import Sale from '@/models/Sale'
import { PaymentSale } from '@/models/Payments'

import mongoose from 'mongoose'
import Product from '@/models/Product'
import ProductWarehouse from '@/models/ProductWarehouse'
import { escapeRegex } from '@/lib/utils'
import { fromBaseQty, round4 } from '@/lib/calculations'

const checkoutSchema = z.object({
  payment_method: z.string().trim().min(1).max(64).default('cash'),
  tendered: z.number().finite().positive().optional(),
  payment_notes: z.string().max(4000).default(''),
})

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Pos_view')
  await dbConnect()
  const url = new URL(req.url)
  const warehouseId = url.searchParams.get('warehouse_id')
  const categoryId = url.searchParams.get('category_id')
  const brandId = url.searchParams.get('brand_id')
  const search = url.searchParams.get('search')
  const barcode = url.searchParams.get('barcode')
  const stockOnly = url.searchParams.get('stock') === '1' || url.searchParams.get('stock') === 'true'
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)))

  if (warehouseId && !mongoose.Types.ObjectId.isValid(warehouseId)) {
    throw new ApiError(422, 'Invalid warehouse')
  }

  const filter: any = { deletedAt: null }
  if (barcode) {
    filter.$or = [
      { code: barcode.trim() },
      { 'variants.code': barcode.trim() },
    ]
  } else if (search) {
    const pattern = escapeRegex(search)
    filter.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { code: { $regex: pattern, $options: 'i' } },
      { 'variants.code': { $regex: pattern, $options: 'i' } },
    ]
  }
  if (categoryId) filter.category_id = categoryId
  if (brandId) filter.brand_id = brandId

  const products = await Product.find(filter)
    .populate('category_id brand_id', 'name')
    .populate('unit_id sale_unit_id purchase_unit_id', 'name short_name operator operator_value base_unit')
    .limit(limit)
    .lean()

  const productIds = products.map((p: any) => p._id)
  const stockMatch: Record<string, unknown> = { product_id: { $in: productIds }, deletedAt: null }
  if (warehouseId) stockMatch.warehouse_id = new mongoose.Types.ObjectId(warehouseId)

  const stockRows = await ProductWarehouse.aggregate([
    { $match: stockMatch },
    { $group: { _id: '$product_id', total_qte: { $sum: '$qte' }, variants: { $push: { variant_id: '$variant_id', qte: '$qte', warehouse_id: '$warehouse_id' } } } },
  ])
  const stockMap = new Map(stockRows.map((row: any) => [row._id.toString(), row]))

  let data = products.map((product: any) => {
    const stock = stockMap.get(product._id.toString()) as any
    const baseStock = stock?.total_qte ?? 0
    const unit = product.sale_unit_id
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

  if (stockOnly) {
    data = data.filter((p: any) => p.current_stock > 0)
  }

  return NextResponse.json({ data, total: data.length })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Pos_view')
  await dbConnect()
  const raw = await req.json()
  const document = canonicalCommercialDocument({ ...raw, status: 'completed', is_pos: true })
  if (!document.client_id) throw new ApiError(422, 'Customer is required')
  const checkout = checkoutSchema.parse({
    payment_method: raw.payment_method,
    tendered: raw.tendered,
    payment_notes: raw.payment_notes,
  })
  const tendered = round2(checkout.tendered ?? document.GrandTotal)
  if (tendered + 0.005 < document.GrandTotal) {
    throw new ApiError(422, 'Tendered amount cannot be less than the sale total')
  }

  const session = await startTransactionSession()
  try {
    const saleRef = await nextReference('sale', Sale, session)
    const [sale] = await Sale.create([{
      ...document,
      Ref: saleRef,
      user_id: user.id,
      status: 'completed',
      is_pos: true,
      paid_amount: document.GrandTotal,
      payment_status: 'paid',
    }], { session })
    await applySaleEffect(sale, 'apply', session)

    const paymentRef = await nextReference('paymentSale', PaymentSale, session)
    const [payment] = await PaymentSale.create([{
      Ref: paymentRef,
      date: document.date,
      sale_id: sale._id,
      user_id: user.id,
      montant: document.GrandTotal,
      change: round2(tendered - document.GrandTotal),
      payment_method: checkout.payment_method,
      notes: checkout.payment_notes,
    }], { session })

    await session.commitTransaction()
    return NextResponse.json({ sale, payment }, { status: 201 })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

