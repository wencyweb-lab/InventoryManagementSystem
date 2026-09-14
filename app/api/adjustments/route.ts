import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, scopedFilter } from '@/lib/permissions'
import Adjustment from '@/models/Adjustment'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { canonicalAdjustment } from '@/lib/validation'
import { nextReference } from '@/lib/references'
import { applyAdjustmentEffect } from '@/lib/stock-effects'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'adjustment_view')
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const warehouseId = url.searchParams.get('warehouse_id')

  const filter: any = scopedFilter(user, { deletedAt: null })
  if (search) filter.Ref = { $regex: escapeRegex(search), $options: 'i' }
  if (warehouseId) filter.warehouse_id = warehouseId
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
    Adjustment.find(filter).populate('warehouse_id user_id', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Adjustment.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'adjustment_add')
  await dbConnect()
  const body = canonicalAdjustment(await req.json())
  const session = await startTransactionSession()
  try {
    const Ref = await nextReference('adjustment', Adjustment, session)
    const [adjustment] = await Adjustment.create([{ ...body, Ref, user_id: user.id }], { session })
    await applyAdjustmentEffect(adjustment, 'apply', session)
    await session.commitTransaction()
    return NextResponse.json(adjustment, { status: 201 })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'adjustment_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)

  const session = await startTransactionSession()
  try {
    const adjustments = await Adjustment.find(scopedFilter(user, { _id: { $in: ids }, deletedAt: null })).session(session)
    for (const adj of adjustments) {
      await applyAdjustmentEffect(adj, 'reverse', session)
      adj.deletedAt = new Date()
      await adj.save({ session })
    }
    await session.commitTransaction()
    return NextResponse.json({ message: `${adjustments.length} adjustments deleted`, count: adjustments.length })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})


