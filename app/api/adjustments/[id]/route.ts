import { reconcileStockEffects } from '@/lib/stock-effects'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requirePermission, requireSession, scopedFilter, withErrorHandler } from '@/lib/permissions'
import { canonicalAdjustment } from '@/lib/validation'
import { applyAdjustmentEffect } from '@/lib/stock-effects'
import Adjustment from '@/models/Adjustment'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'adjustment_view')
  await dbConnect()
  const adjustment = await Adjustment.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
    .populate('warehouse_id user_id', 'name')
    .populate('details.product_id', 'name code')
  if (!adjustment) throw new ApiError(404, 'Adjustment not found')
  return NextResponse.json(adjustment)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'adjustment_edit')
  await dbConnect()
  const body = canonicalAdjustment(await req.json())
  const session = await startTransactionSession()
  try {
    const adjustment = await Adjustment.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!adjustment) throw new ApiError(404, 'Adjustment not found')
    const previous = adjustment.toObject()
    Object.assign(adjustment, { ...body, Ref: adjustment.Ref, user_id: adjustment.user_id })
    await adjustment.save({ session })
    await reconcileStockEffects(previous, adjustment, 'adjustment', session)
    await session.commitTransaction()
    return NextResponse.json(adjustment)
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'adjustment_delete')
  await dbConnect()
  const session = await startTransactionSession()
  try {
    const adjustment = await Adjustment.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!adjustment) throw new ApiError(404, 'Adjustment not found')
    await applyAdjustmentEffect(adjustment, 'reverse', session)
    adjustment.deletedAt = new Date()
    await adjustment.save({ session })
    await session.commitTransaction()
    return NextResponse.json({ message: 'Adjustment deleted' })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})


