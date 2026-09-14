import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, scopedFilter } from '@/lib/permissions'
import Transfer from '@/models/Transfer'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { canonicalTransfer } from '@/lib/validation'
import { nextReference } from '@/lib/references'
import { applyTransferEffect } from '@/lib/stock-effects'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'transfer_view')
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const fromWarehouseId = url.searchParams.get('from_warehouse_id')
  const toWarehouseId = url.searchParams.get('to_warehouse_id')

  const filter: any = scopedFilter(user, { deletedAt: null })
  if (search) filter.Ref = { $regex: escapeRegex(search), $options: 'i' }
  if (status && ['completed', 'pending', 'sent'].includes(status)) filter.status = status
  if (fromWarehouseId) filter.from_warehouse_id = fromWarehouseId
  if (toWarehouseId) filter.to_warehouse_id = toWarehouseId
  if (dateFrom || dateTo) {
    filter.date = {}
    if (dateFrom) filter.date.$gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      filter.date.$lte = end
    }
  }
  const [data, total] = await Promise.all([
    Transfer.find(filter)
      .populate('from_warehouse_id to_warehouse_id user_id', 'name')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transfer.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'transfer_add')
  await dbConnect()
  const body = canonicalTransfer(await req.json())
  const session = await startTransactionSession()
  try {
    const Ref = await nextReference('transfer', Transfer, session)
    const [transfer] = await Transfer.create([{ ...body, Ref, user_id: user.id }], { session })
    await applyTransferEffect(transfer, 'apply', session)
    await session.commitTransaction()
    return NextResponse.json(transfer, { status: 201 })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'transfer_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)

  const session = await startTransactionSession()
  try {
    const transfers = await Transfer.find(scopedFilter(user, { _id: { $in: ids }, deletedAt: null })).session(session)
    for (const transfer of transfers) {
      await applyTransferEffect(transfer, 'reverse', session)
      transfer.deletedAt = new Date()
      await transfer.save({ session })
    }
    await session.commitTransaction()
    return NextResponse.json({ message: `${transfers.length} transfers deleted`, count: transfers.length })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})


