import { parseBulkIds } from '@/lib/bulk'
import { PaymentPurchase } from '@/models/Payments'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, scopedFilter, ApiError } from '@/lib/permissions'
import Purchase from '@/models/Purchase'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { canonicalCommercialDocument } from '@/lib/validation'
import { nextReference } from '@/lib/references'
import { applyPurchaseEffect } from '@/lib/stock-effects'
import { calcPaymentStatus, round2 } from '@/lib/calculations'

// GET /api/purchases
export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Purchases_view')
  await dbConnect()

  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const paymentStatus = url.searchParams.get('payment_status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')

  const filter: any = scopedFilter(user, { deletedAt: null })
  if (search) filter.Ref = { $regex: escapeRegex(search), $options: 'i' }
  if (paymentStatus && ['paid', 'partial', 'unpaid'].includes(paymentStatus)) {
    filter.payment_status = paymentStatus
  }
  if (dateFrom || dateTo) {
    filter.date = {}
    if (dateFrom) filter.date.$gte = new Date(dateFrom)
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); filter.date.$lte = end }
  }

  const [data, total] = await Promise.all([
    Purchase.find(filter)
      .populate('provider_id', 'name')
      .populate('warehouse_id', 'name')
      .populate('user_id', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ])

  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

// POST /api/purchases — create purchase + optional stock add + optional initial payment
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Purchases_add')
  await dbConnect()

  const raw = await req.json()
  const body = canonicalCommercialDocument(raw)
  if (!['ordered', 'pending', 'received'].includes(body.status)) {
    throw new ApiError(422, 'Invalid purchase status')
  }
  if (!body.provider_id) throw new ApiError(422, 'Supplier is required')

  const paymentInput = raw.payment || (raw.paid_amount > 0 ? {
    amount: raw.paid_amount,
    Reglement: raw.payment_method || 'Cash',
    notes: raw.payment_notes || '',
    received_amount: raw.received_amount,
    change: raw.change,
  } : null)

  const session = await startTransactionSession()

  try {
    const Ref = await nextReference('purchase', Purchase, session)
    const [purchase] = await Purchase.create([{
      ...body,
      Ref,
      user_id: user.id,
      paid_amount: 0,
      payment_status: 'unpaid',
    }], { session })

    // Apply stock if status is 'received'
    await applyPurchaseEffect(purchase, 'apply', session)

    if (paymentInput && Number(paymentInput.amount) > 0) {
      const amount = round2(Number(paymentInput.amount))
      if (amount > purchase.GrandTotal + 0.005) {
        throw new ApiError(409, `Initial payment (${amount.toFixed(2)}) cannot exceed purchase grand total (${purchase.GrandTotal.toFixed(2)})`)
      }
      if (amount > 0) {
        const paymentRef = await nextReference('paymentPurchase', PaymentPurchase, session)
        const receivedAmount = paymentInput.received_amount ? Number(paymentInput.received_amount) : amount
        const change = round2(paymentInput.change ?? Math.max(0, receivedAmount - amount))
        await PaymentPurchase.create([{
          Ref: paymentRef,
          purchase_id: purchase._id,
          user_id: user.id,
          date: paymentInput.date ? new Date(paymentInput.date) : purchase.date,
          montant: amount,
          change,
          payment_method: paymentInput.Reglement || paymentInput.payment_method || 'Cash',
          notes: paymentInput.notes || '',
        }], { session })
        purchase.paid_amount = amount
        purchase.payment_status = calcPaymentStatus(amount, purchase.GrandTotal)
        await purchase.save({ session })
      }
    }

    await session.commitTransaction()
    return NextResponse.json(purchase, { status: 201 })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Purchases_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)

  const session = await startTransactionSession()
  try {
    const purchases = await Purchase.find(scopedFilter(user, { _id: { $in: ids }, deletedAt: null })).session(session)
    for (const purchase of purchases) {
      await applyPurchaseEffect(purchase, 'reverse', session)
      purchase.deletedAt = new Date()
      await PaymentPurchase.updateMany({ purchase_id: purchase._id, deletedAt: null }, { deletedAt: purchase.deletedAt }, { session })
      await purchase.save({ session })
    }
    await session.commitTransaction()
    return NextResponse.json({ message: `${purchases.length} purchases deleted`, count: purchases.length })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})



