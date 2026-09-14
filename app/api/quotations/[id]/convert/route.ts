import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, scopedFilter, withErrorHandler } from '@/lib/permissions'
import Quotation from '@/models/Quotation'

type Ctx = { params: { id: string } }

/** Return a safe sale-form preload. Creating the sale still uses /api/sales. */
export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'Quotations_view', 'Sales_add')
  await dbConnect()
  const quotation: any = await Quotation.findOne(
    scopedFilter(user, { _id: ctx.params.id, deletedAt: null })
  ).populate('details.product_id details.unit_id').lean()
  if (!quotation) throw new ApiError(404, 'Quotation not found')
  return NextResponse.json({
    quotation_id: quotation._id,
    date: new Date().toISOString(),
    client_id: quotation.client_id,
    warehouse_id: quotation.warehouse_id,
    status: 'pending',
    notes: quotation.notes,
    discount: quotation.discount,
    shipping: quotation.shipping,
    tax_rate: quotation.tax_rate,
    details: quotation.details.map((detail: any) => ({
      ...detail,
      product_id: detail.product_id?._id ?? detail.product_id,
      name: detail.product_id?.name ?? 'Product',
      code: detail.product_id?.code ?? '',
      unit_id: detail.unit_id?._id ?? detail.unit_id,
      unit_name: detail.unit_id?.short_name ?? detail.unit_id?.name ?? '',
    })),
  })
})
