import { parseBulkIds } from '@/lib/bulk'
import { PaymentSale } from '@/models/Payments'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, scopedFilter, ApiError } from '@/lib/permissions'
import Sale from '@/models/Sale'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { canonicalCommercialDocument } from '@/lib/validation'
import { nextReference } from '@/lib/references'
import { applySaleEffect } from '@/lib/stock-effects'
import { calcPaymentStatus, round2 } from '@/lib/calculations'

// GET /api/sales
export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Sales_view')
  await dbConnect()

  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const isPos = url.searchParams.get('is_pos')
  const paymentStatus = url.searchParams.get('payment_status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')

  const filter: any = scopedFilter(user, { deletedAt: null })
  if (search) filter.Ref = { $regex: escapeRegex(search), $options: 'i' }
  if (isPos !== null) filter.is_pos = isPos === 'true'
  if (paymentStatus && ['paid', 'partial', 'unpaid'].includes(paymentStatus)) {
    filter.payment_status = paymentStatus
  }
  if (dateFrom || dateTo) {
    filter.date = {}
    if (dateFrom) filter.date.$gte = new Date(dateFrom)
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); filter.date.$lte = end }
  }

  const [data, total] = await Promise.all([
    Sale.find(filter)
      .populate('client_id', 'name')
      .populate('warehouse_id', 'name')
      .populate('user_id', 'name')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Sale.countDocuments(filter),
  ])

  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

// POST /api/sales — create sale + optional stock subtract + optional initial payment
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Sales_add')
  await dbConnect()

  const raw = await req.json()
  const body = canonicalCommercialDocument(raw)
  if (!['ordered', 'pending', 'completed'].includes(body.status)) {
    throw new ApiError(422, 'Invalid sale status')
  }
  if (!body.client_id) throw new ApiError(422, 'Customer is required')

  const paymentInput = raw.payment || (raw.paid_amount > 0 ? {
    amount: raw.paid_amount,
    Reglement: raw.payment_method || 'Cash',
    notes: raw.payment_notes || '',
    received_amount: raw.received_amount,
    change: raw.change,
  } : null)

  const session = await startTransactionSession()

  try {
    const Ref = await nextReference('sale', Sale, session)
    const [sale] = await Sale.create([{
      ...body,
      Ref,
      user_id: user.id,
      paid_amount: 0,
      payment_status: 'unpaid',
    }], { session })
    await applySaleEffect(sale, 'apply', session)

    if (paymentInput && Number(paymentInput.amount) > 0) {
      const amount = round2(Number(paymentInput.amount))
      if (amount > sale.GrandTotal + 0.005) {
        throw new ApiError(409, `Initial payment (${amount.toFixed(2)}) cannot exceed sale grand total (${sale.GrandTotal.toFixed(2)})`)
      }
      if (amount > 0) {
        const paymentRef = await nextReference('paymentSale', PaymentSale, session)
        const receivedAmount = paymentInput.received_amount ? Number(paymentInput.received_amount) : amount
        const change = round2(paymentInput.change ?? Math.max(0, receivedAmount - amount))
        await PaymentSale.create([{
          Ref: paymentRef,
          sale_id: sale._id,
          user_id: user.id,
          date: paymentInput.date ? new Date(paymentInput.date) : sale.date,
          montant: amount,
          change,
          payment_method: paymentInput.Reglement || paymentInput.payment_method || 'Cash',
          notes: paymentInput.notes || '',
        }], { session })
        sale.paid_amount = amount
        sale.payment_status = calcPaymentStatus(amount, sale.GrandTotal)
        await sale.save({ session })
      }
    }

    await session.commitTransaction()
    return NextResponse.json(sale, { status: 201 })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Sales_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)

  const session = await startTransactionSession()
  try {
    const sales = await Sale.find(scopedFilter(user, { _id: { $in: ids }, deletedAt: null })).session(session)
    for (const sale of sales) {
      await applySaleEffect(sale, 'reverse', session)
      sale.deletedAt = new Date()
      await PaymentSale.updateMany({ sale_id: sale._id, deletedAt: null }, { deletedAt: sale.deletedAt }, { session })
      await sale.save({ session })
    }
    await session.commitTransaction()
    return NextResponse.json({ message: `${sales.length} sales deleted`, count: sales.length })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})



