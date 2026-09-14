import { reconcileStockEffects } from '@/lib/stock-effects'
import { PaymentPurchase } from '@/models/Payments'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, ApiError, scopedFilter } from '@/lib/permissions'
import Purchase from '@/models/Purchase'
import { calcPaymentStatus } from '@/lib/calculations'
import { canonicalCommercialDocument } from '@/lib/validation'
import { applyPurchaseEffect } from '@/lib/stock-effects'

type Ctx = { params: { id: string } }

// GET /api/purchases/[id]
export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Purchases_view')
  await dbConnect()

  const purchase = await Purchase.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
    .populate('provider_id', 'name email phone')
    .populate('warehouse_id', 'name')
    .populate('user_id', 'name')
    .populate('details.product_id', 'name code')
    .populate('details.unit_id', 'name short_name')

  if (!purchase) throw new ApiError(404, 'Purchase not found')
  return NextResponse.json(purchase)
})

// PUT /api/purchases/[id] — update: reverse old stock, apply new
export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Purchases_edit')
  await dbConnect()

  const body = canonicalCommercialDocument(await req.json())
  if (!['ordered', 'pending', 'received'].includes(body.status)) {
    throw new ApiError(422, 'Invalid purchase status')
  }
  if (!body.provider_id) throw new ApiError(422, 'Supplier is required')
  const session = await startTransactionSession()

  try {
    const purchase = await Purchase.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!purchase) throw new ApiError(404, 'Purchase not found')

    // Reverse old stock effect
    const previous = purchase.toObject()

    if (purchase.paid_amount > body.GrandTotal + 0.005) {
      throw new ApiError(409, 'The new total cannot be less than payments already recorded')
    }

    // Apply updates
    Object.assign(purchase, {
      ...body,
      user_id: purchase.user_id, // preserve creator
      Ref: purchase.Ref,          // preserve reference
      paid_amount: purchase.paid_amount,
      payment_status: calcPaymentStatus(purchase.paid_amount, body.GrandTotal),
    })
    await purchase.save({ session })

    // Apply new stock effect
    await reconcileStockEffects(previous, purchase, 'purchase', session)

    await session.commitTransaction()
    return NextResponse.json(purchase)
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})

// DELETE /api/purchases/[id]
export const DELETE = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Purchases_delete')
  await dbConnect()

  const session = await startTransactionSession()

  try {
    const purchase = await Purchase.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!purchase) throw new ApiError(404, 'Purchase not found')

    // Reverse stock before deleting
    await applyPurchaseEffect(purchase, 'reverse', session)

    purchase.deletedAt = new Date()
      await PaymentPurchase.updateMany({ purchase_id: purchase._id, deletedAt: null }, { deletedAt: purchase.deletedAt }, { session })
    await purchase.save({ session })

    await session.commitTransaction()
    return NextResponse.json({ message: 'Purchase deleted' })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})



