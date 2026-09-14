import { parseBulkIds } from '@/lib/bulk'
import { validateDocumentReferences } from '@/lib/inventory'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requireSession, requirePermission, scopedFilter, withErrorHandler } from '@/lib/permissions'
import Quotation from '@/models/Quotation'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { canonicalCommercialDocument } from '@/lib/validation'
import { nextReference } from '@/lib/references'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_view')
  await dbConnect()
  const url = new URL(req.url)
  const { page, limit, skip, search } = parsePagination(url)
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const warehouseId = url.searchParams.get('warehouse_id')
  const clientId = url.searchParams.get('client_id')

  const filter: any = scopedFilter(user, { deletedAt: null })
  if (search) filter.Ref = { $regex: escapeRegex(search), $options: 'i' }
  if (status && ['pending', 'sent'].includes(status)) filter.status = status
  if (warehouseId) filter.warehouse_id = warehouseId
  if (clientId) filter.client_id = clientId
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
    Quotation.find(filter)
      .populate('client_id warehouse_id user_id', 'name')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quotation.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_add')
  await dbConnect()
  const body = canonicalCommercialDocument(await req.json())
  if (!['pending', 'sent'].includes(body.status)) throw new ApiError(422, 'Invalid quotation status')
  if (!body.client_id) throw new ApiError(422, 'Customer is required')
  await validateDocumentReferences(body)
  const Ref = await nextReference('quotation', Quotation)
  const quotation = await Quotation.create({ ...body, Ref, user_id: user.id })
  return NextResponse.json(quotation, { status: 201 })
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)
  await Quotation.updateMany(scopedFilter(user, { _id: { $in: ids }, deletedAt: null }), { $set: { deletedAt: new Date() } })
  return NextResponse.json({ message: `${ids.length} quotations deleted`, count: ids.length })
})


