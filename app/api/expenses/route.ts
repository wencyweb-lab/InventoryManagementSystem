import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, scopedFilter, withErrorHandler } from '@/lib/permissions'
import { Expense } from '@/models/Expense'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { nextReference } from '@/lib/references'
import { expenseSchema } from '@/lib/validation'
import { validateExpenseReferences } from '@/lib/resource-integrity'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_view')
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const categoryId = url.searchParams.get('category_id')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')

  const filter: any = scopedFilter(user, { deletedAt: null })
  if (categoryId) filter.category_id = categoryId
  if (dateFrom || dateTo) {
    filter.date = {}
    if (dateFrom) filter.date.$gte = new Date(dateFrom)
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filter.date.$lte = to
    }
  }
  if (search) { const pattern = escapeRegex(search); filter.$or = [{ Ref: { $regex: pattern, $options: 'i' } }, { details: { $regex: pattern, $options: 'i' } }] }

  if (url.searchParams.get('all') === 'true') {
    return NextResponse.json(await Expense.find(filter).populate('category_id warehouse_id user_id', 'name').sort({ date: -1 }).lean())
  }

  const [data, total] = await Promise.all([
    Expense.find(filter).populate('category_id warehouse_id user_id', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_add')
  await dbConnect()
  const body = expenseSchema.parse(await req.json())
  const session = await startTransactionSession()
  try {
    await validateExpenseReferences(body, session)
    const Ref = await nextReference('expense', Expense, session)
    const [expense] = await Expense.create([{ ...body, Ref, user_id: user.id }], { session })
    await session.commitTransaction()
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)
  await Expense.updateMany(scopedFilter(user, { _id: { $in: ids }, deletedAt: null }), { $set: { deletedAt: new Date() } })
  return NextResponse.json({ message: `${ids.length} expenses deleted`, count: ids.length })
})


