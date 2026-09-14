import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { warehouseSchema } from '@/lib/validation'
import Warehouse from '@/models/Warehouse'
import ProductWarehouse from '@/models/ProductWarehouse'
import { hasDocumentReference } from '@/lib/resource-integrity'
import { Setting } from '@/models/Settings'
import { Expense } from '@/models/Expense'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  await requireSession()
  await dbConnect()
  const warehouse = await Warehouse.findOne({ _id: ctx.params.id, deletedAt: null })
  if (!warehouse) throw new ApiError(404, 'Warehouse not found')
  return NextResponse.json(warehouse)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'warehouse')
  await dbConnect()
  const warehouse = await Warehouse.findOneAndUpdate(
    { _id: ctx.params.id, deletedAt: null },
    warehouseSchema.parse(await req.json()),
    { new: true, runValidators: true }
  )
  if (!warehouse) throw new ApiError(404, 'Warehouse not found')
  return NextResponse.json(warehouse)
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'warehouse')
  await dbConnect()
  const session = await startTransactionSession()
  try {
    const warehouse = await Warehouse.findOne({ _id: ctx.params.id, deletedAt: null }).session(session)
    if (!warehouse) throw new ApiError(404, 'Warehouse not found')
    const hasStock = await ProductWarehouse.exists({ warehouse_id: warehouse._id, deletedAt: null, qte: { $ne: 0 } }).session(session)
    if (hasStock) throw new ApiError(409, 'A warehouse with stock cannot be deleted')
    for (const field of ['warehouse_id', 'from_warehouse_id', 'to_warehouse_id']) {
      if (await hasDocumentReference(field, [warehouse._id], session)) throw new ApiError(409, 'Warehouse is referenced by documents')
    }
    if (await Setting.exists({ warehouse_id: warehouse._id }).session(session) || await Expense.exists({ warehouse_id: warehouse._id, deletedAt: null }).session(session)) throw new ApiError(409, 'Warehouse is in use by settings or expenses')
    const now = new Date()
    warehouse.deletedAt = now
    await warehouse.save({ session })
    await ProductWarehouse.updateMany({ warehouse_id: warehouse._id, deletedAt: null }, { deletedAt: now }, { session })
    await session.commitTransaction()
    return NextResponse.json({ message: 'Warehouse deleted' })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

