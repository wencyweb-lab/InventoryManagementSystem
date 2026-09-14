import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ExpenseCategory } from '@/models/Expense'
import { expenseCategorySchema } from '@/lib/validation'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { guardResourceDeletion } from '@/lib/resource-integrity'

type Ctx = { params: { id: string } }

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_edit')
  await dbConnect()
  const category = await ExpenseCategory.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, expenseCategorySchema.parse(await req.json()), { new: true })
  if (!category) throw new ApiError(404, 'Expense category not found')
  return NextResponse.json(category)
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_delete')
  await dbConnect()
  await guardResourceDeletion('ExpenseCategory', [ctx.params.id])
  const category = await ExpenseCategory.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, { deletedAt: new Date() }, { new: true })
  if (!category) throw new ApiError(404, 'Expense category not found')
  return NextResponse.json({ message: 'Expense category deleted' })
})
