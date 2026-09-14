import { reconcileStockEffects } from '@/lib/stock-effects'
import { PaymentSale } from '@/models/Payments'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, ApiError, scopedFilter } from '@/lib/permissions'
import Sale from '@/models/Sale'
import { calcPaymentStatus } from '@/lib/calculations'
import { canonicalCommercialDocument } from '@/lib/validation'
import { applySaleEffect } from '@/lib/stock-effects'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Sales_view')
  await dbConnect()

  const sale = await Sale.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
    .populate('client_id', 'name email phone address')
    .populate('warehouse_id', 'name')
    .populate('user_id', 'name')
    .populate('details.product_id', 'name code')
    .populate('details.unit_id', 'name short_name')

  if (!sale) throw new ApiError(404, 'Sale not found')
  return NextResponse.json(sale)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Sales_edit')
  await dbConnect()

  const body = canonicalCommercialDocument(await req.json())
  if (!['ordered', 'pending', 'completed'].includes(body.status)) {
    throw new ApiError(422, 'Invalid sale status')
  }
  if (!body.client_id) throw new ApiError(422, 'Customer is required')
  const session = await startTransactionSession()

  try {
    const sale = await Sale.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!sale) throw new ApiError(404, 'Sale not found')

    const previous = sale.toObject()
    if (sale.paid_amount > body.GrandTotal + 0.005) {
      throw new ApiError(409, 'The new total cannot be less than payments already recorded')
    }
    Object.assign(sale, {
      ...body,
      user_id: sale.user_id,
      Ref: sale.Ref,
      paid_amount: sale.paid_amount,
      payment_status: calcPaymentStatus(sale.paid_amount, body.GrandTotal),
    })
    await sale.save({ session })
    await reconcileStockEffects(previous, sale, 'sale', session)

    await session.commitTransaction()
    return NextResponse.json(sale)
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Sales_delete')
  await dbConnect()

  const session = await startTransactionSession()

  try {
    const sale = await Sale.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!sale) throw new ApiError(404, 'Sale not found')

    await applySaleEffect(sale, 'reverse', session)
    sale.deletedAt = new Date()
      await PaymentSale.updateMany({ sale_id: sale._id, deletedAt: null }, { deletedAt: sale.deletedAt }, { session })
    await sale.save({ session })

    await session.commitTransaction()
    return NextResponse.json({ message: 'Sale deleted' })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})



