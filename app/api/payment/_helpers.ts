import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, ApiError, scopedFilter } from '@/lib/permissions'
import { PaymentSale, PaymentPurchase, PaymentSaleReturn, PaymentPurchaseReturn } from '@/models/Payments'
import Sale from '@/models/Sale'
import Purchase from '@/models/Purchase'
import { SaleReturn, PurchaseReturn } from '@/models/Returns'
import { calcPaymentStatus, round2 } from '@/lib/calculations'
import { paymentSchema } from '@/lib/validation'
import { nextReference, previewNextReference } from '@/lib/references'
import '@/models/Client'
import '@/models/Provider'
import '@/models/Warehouse'

export type PaymentType = 'sale' | 'purchase' | 'sale-return' | 'purchase-return'

const CONFIG = {
  sale: { payment: PaymentSale, parent: Sale, parentField: 'sale_id', ref: 'paymentSale' },
  purchase: { payment: PaymentPurchase, parent: Purchase, parentField: 'purchase_id', ref: 'paymentPurchase' },
  'sale-return': { payment: PaymentSaleReturn, parent: SaleReturn, parentField: 'sale_return_id', ref: 'paymentSaleReturn' },
  'purchase-return': { payment: PaymentPurchaseReturn, parent: PurchaseReturn, parentField: 'purchase_return_id', ref: 'paymentPurchaseReturn' },
} as const

function config(type: PaymentType) {
  return CONFIG[type] as any
}

function parentIdFromBody(body: Record<string, any>, parentField: string) {
  return body[parentField] ?? body.parent_id
}

export function makePaymentRoute(type: PaymentType, addPerm: string, viewPerm: string) {
  const { payment: Model, parent: ParentModel, parentField, ref: refType } = config(type)
  return {
    GET: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, viewPerm)
      await dbConnect()
      const url = new URL(req.url)

      if (url.searchParams.get('preview_ref') === 'true' || url.searchParams.get('next_ref') === 'true') {
        const ref = await previewNextReference(refType, Model)
        return NextResponse.json({ ref })
      }

      const parentId = url.searchParams.get('parent_id')

      if (parentId) {
        const parent = await ParentModel.findOne(scopedFilter(user, { _id: parentId, deletedAt: null }))
        if (!parent) throw new ApiError(404, 'Parent document not found')
      }

      const parentIds = parentId ? [parentId] : await ParentModel.find(scopedFilter(user, { deletedAt: null })).distinct('_id')
      const filter: Record<string, unknown> = { deletedAt: null, [parentField]: { $in: parentIds } }
      const data = await Model.find(filter).populate('user_id', 'name').sort({ createdAt: -1 }).lean()
      return NextResponse.json(data)
    }),

    POST: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, addPerm)
      await dbConnect()
      const body = paymentSchema.parse(await req.json())
      const parentId = parentIdFromBody(body, parentField)
      if (!parentId) throw new ApiError(422, 'Parent document ID is required')

      const session = await startTransactionSession()
      try {
        const parent: any = await ParentModel.findOne(
          scopedFilter(user, { _id: parentId, deletedAt: null })
        ).session(session)
        if (!parent) throw new ApiError(404, 'Parent document not found')

        const outstanding = round2(parent.GrandTotal - (parent.paid_amount || 0))
        if (body.montant > outstanding + 0.005) {
          throw new ApiError(409, `Payment exceeds the outstanding amount of ${outstanding.toFixed(2)}`)
        }

        const Ref = await nextReference(refType, Model, session)
        const [payment] = await Model.create([{
          date: body.date,
          montant: round2(body.montant),
          change: round2(body.change),
          payment_method: body.payment_method,
          notes: body.notes,
          [parentField]: parentId,
          Ref,
          user_id: user.id,
        }], { session })

        parent.paid_amount = round2((parent.paid_amount || 0) + payment.montant)
        parent.payment_status = calcPaymentStatus(parent.paid_amount, parent.GrandTotal)
        await parent.save({ session })
        await session.commitTransaction()
        return NextResponse.json(payment, { status: 201 })
      } catch (error) {
        await session.abortTransaction()
        throw error
      } finally {
        await session.endSession()
      }
    }),
  }
}

export function makePaymentSingleRoute(
  type: PaymentType,
  editPerm: string,
  deletePerm: string,
  viewPerm: string
) {
  const { payment: Model, parent: ParentModel, parentField } = config(type)
  return {
    GET: withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, viewPerm)
      await dbConnect()
      const payment: any = await Model.findOne({ _id: ctx.params.id, deletedAt: null }).populate('user_id', 'name')
      if (!payment) throw new ApiError(404, 'Payment not found')
      const party = type === 'sale' || type === 'sale-return' ? 'client_id' : 'provider_id'
      const parent = await ParentModel.findOne(scopedFilter(user, { _id: payment[parentField], deletedAt: null })).populate(`${party} warehouse_id`, 'name email phone address')
      if (!parent) throw new ApiError(404, 'Payment not found')
      return NextResponse.json({ ...payment.toObject(), document: parent })
    }),

    PUT: withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, editPerm)
      await dbConnect()
      const body = paymentSchema.parse(await req.json())
      const session = await startTransactionSession()
      try {
        const payment: any = await Model.findOne({ _id: ctx.params.id, deletedAt: null }).session(session)
        if (!payment) throw new ApiError(404, 'Payment not found')
        const parent: any = await ParentModel.findOne(
          scopedFilter(user, { _id: payment[parentField], deletedAt: null })
        ).session(session)
        if (!parent) throw new ApiError(404, 'Payment not found')

        const maximum = round2(parent.GrandTotal - parent.paid_amount + payment.montant)
        if (body.montant > maximum + 0.005) {
          throw new ApiError(409, `Payment exceeds the available amount of ${maximum.toFixed(2)}`)
        }

        parent.paid_amount = round2(parent.paid_amount - payment.montant + body.montant)
        parent.payment_status = calcPaymentStatus(parent.paid_amount, parent.GrandTotal)
        Object.assign(payment, {
          date: body.date,
          montant: round2(body.montant),
          change: round2(body.change),
          payment_method: body.payment_method,
          notes: body.notes,
          Ref: payment.Ref,
          user_id: payment.user_id,
          [parentField]: payment[parentField],
        })
        await parent.save({ session })
        await payment.save({ session })
        await session.commitTransaction()
        return NextResponse.json(payment)
      } catch (error) {
        await session.abortTransaction()
        throw error
      } finally {
        await session.endSession()
      }
    }),

    DELETE: withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, deletePerm)
      await dbConnect()
      const session = await startTransactionSession()
      try {
        const payment: any = await Model.findOne({ _id: ctx.params.id, deletedAt: null }).session(session)
        if (!payment) throw new ApiError(404, 'Payment not found')
        const parent: any = await ParentModel.findOne(
          scopedFilter(user, { _id: payment[parentField], deletedAt: null })
        ).session(session)
        if (!parent) throw new ApiError(404, 'Payment not found')
        parent.paid_amount = round2(Math.max(0, parent.paid_amount - payment.montant))
        parent.payment_status = calcPaymentStatus(parent.paid_amount, parent.GrandTotal)
        payment.deletedAt = new Date()
        await parent.save({ session })
        await payment.save({ session })
        await session.commitTransaction()
        return NextResponse.json({ message: 'Payment deleted' })
      } catch (error) {
        await session.abortTransaction()
        throw error
      } finally {
        await session.endSession()
      }
    }),
  }
}


