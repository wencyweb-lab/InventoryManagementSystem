import { reconcileStockEffects } from '@/lib/stock-effects'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requirePermission, requireSession, scopedFilter, withErrorHandler } from '@/lib/permissions'
import { canonicalTransfer } from '@/lib/validation'
import { applyTransferEffect } from '@/lib/stock-effects'
import Transfer from '@/models/Transfer'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'transfer_view')
  await dbConnect()
  const transfer = await Transfer.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
    .populate('from_warehouse_id to_warehouse_id user_id', 'name')
    .populate('details.product_id', 'name code')
    .populate('details.unit_id', 'name short_name')
  if (!transfer) throw new ApiError(404, 'Transfer not found')
  return NextResponse.json(transfer)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'transfer_edit')
  await dbConnect()
  const body = canonicalTransfer(await req.json())
  const session = await startTransactionSession()
  try {
    const transfer = await Transfer.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!transfer) throw new ApiError(404, 'Transfer not found')
    const previous = transfer.toObject()
    Object.assign(transfer, { ...body, Ref: transfer.Ref, user_id: transfer.user_id })
    await transfer.save({ session })
    await reconcileStockEffects(previous, transfer, 'transfer', session)
    await session.commitTransaction()
    return NextResponse.json(transfer)
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'transfer_delete')
  await dbConnect()
  const session = await startTransactionSession()
  try {
    const transfer = await Transfer.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
    if (!transfer) throw new ApiError(404, 'Transfer not found')
    await applyTransferEffect(transfer, 'reverse', session)
    transfer.deletedAt = new Date()
    await transfer.save({ session })
    await session.commitTransaction()
    return NextResponse.json({ message: 'Transfer deleted' })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})


