import { validateDocumentReferences } from '@/lib/inventory'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, scopedFilter, withErrorHandler } from '@/lib/permissions'
import { canonicalCommercialDocument } from '@/lib/validation'
import Quotation from '@/models/Quotation'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_view')
  await dbConnect()
  const quotation = await Quotation.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
    .populate('client_id', 'name email phone address')
    .populate('warehouse_id user_id', 'name')
    .populate('details.product_id', 'name code')
    .populate('details.unit_id', 'name short_name')
  if (!quotation) throw new ApiError(404, 'Quotation not found')
  return NextResponse.json(quotation)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_edit')
  await dbConnect()
  const body = canonicalCommercialDocument(await req.json())
  if (!['pending', 'sent'].includes(body.status)) throw new ApiError(422, 'Invalid quotation status')
  if (!body.client_id) throw new ApiError(422, 'Customer is required')
  await validateDocumentReferences(body)
  const quotation = await Quotation.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
  if (!quotation) throw new ApiError(404, 'Quotation not found')
  Object.assign(quotation, { ...body, Ref: quotation.Ref, user_id: quotation.user_id })
  await quotation.save()
  return NextResponse.json(quotation)
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_delete')
  await dbConnect()
  const quotation = await Quotation.findOneAndUpdate(
    scopedFilter(user, { _id: ctx.params.id, deletedAt: null }),
    { deletedAt: new Date() },
    { new: true }
  )
  if (!quotation) throw new ApiError(404, 'Quotation not found')
  return NextResponse.json({ message: 'Quotation deleted' })
})

