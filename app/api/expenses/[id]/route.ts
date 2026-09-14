import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, scopedFilter, withErrorHandler } from '@/lib/permissions'
import { expenseSchema } from '@/lib/validation'
import { Expense } from '@/models/Expense'
import { validateExpenseReferences } from '@/lib/resource-integrity'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_view')
  await dbConnect()
  const expense = await Expense.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).populate('category_id warehouse_id user_id', 'name')
  if (!expense) throw new ApiError(404, 'Expense not found')
  return NextResponse.json(expense)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_edit')
  await dbConnect()
  const expense = await Expense.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
  if (!expense) throw new ApiError(404, 'Expense not found')
  const body = expenseSchema.parse(await req.json())
  await validateExpenseReferences(body)
  Object.assign(expense, { ...body, Ref: expense.Ref, user_id: expense.user_id })
  await expense.save()
  return NextResponse.json(expense)
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_delete')
  await dbConnect()
  const expense = await Expense.findOneAndUpdate(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }), { deletedAt: new Date() }, { new: true })
  if (!expense) throw new ApiError(404, 'Expense not found')
  return NextResponse.json({ message: 'Expense deleted' })
})
