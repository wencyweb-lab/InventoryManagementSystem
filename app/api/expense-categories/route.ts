import { parseBulkIds } from '@/lib/bulk'
import { guardResourceDeletion } from '@/lib/resource-integrity'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ExpenseCategory } from '@/models/Expense'
import { expenseCategorySchema } from '@/lib/validation'
import { requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { escapeRegex, parsePagination } from '@/lib/utils'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_view')
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const filter: any = { deletedAt: null }
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }
  if (url.searchParams.get('all') === 'true') return NextResponse.json(await ExpenseCategory.find(filter).select('name').sort({ name: 1 }).lean())
  const [data, total] = await Promise.all([
    ExpenseCategory.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    ExpenseCategory.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_add')
  await dbConnect()
  return NextResponse.json(await ExpenseCategory.create(expenseCategorySchema.parse(await req.json())), { status: 201 })
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'expense_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)
  await guardResourceDeletion('ExpenseCategory', ids)
  await ExpenseCategory.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } })
  return NextResponse.json({ message: `${ids.length} categories deleted`, count: ids.length })
})

