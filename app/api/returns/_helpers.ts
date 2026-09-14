import { reconcileStockEffects } from '@/lib/stock-effects'
import { parseBulkIds } from '@/lib/bulk'
import { PaymentSaleReturn, PaymentPurchaseReturn } from '@/models/Payments'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { requireSession, requirePermission, withErrorHandler, ApiError, scopedFilter } from '@/lib/permissions'
import { SaleReturn, PurchaseReturn } from '@/models/Returns'
import { calcPaymentStatus } from '@/lib/calculations'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { canonicalCommercialDocument } from '@/lib/validation'
import { nextReference } from '@/lib/references'
import { applyReturnEffect } from '@/lib/stock-effects'

type ReturnType = 'sale' | 'purchase'

function getModel(type: ReturnType) {
  return type === 'sale' ? SaleReturn : PurchaseReturn
}

export function makeListRoute(type: ReturnType, viewPerm: string, addPerm: string, deletePerm?: string) {
  const Model = getModel(type)
  const refType = type === 'sale' ? 'saleReturn' : 'purchaseReturn'

  return {
    GET: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, viewPerm)
      await dbConnect()

      const url = new URL(req.url)
      const { page, limit, skip, search } = parsePagination(url)
      const paymentStatus = url.searchParams.get('payment_status')
      const status = url.searchParams.get('status')
      const dateFrom = url.searchParams.get('date_from')
      const dateTo = url.searchParams.get('date_to')
      const warehouseId = url.searchParams.get('warehouse_id')
      const partyId = url.searchParams.get(type === 'sale' ? 'client_id' : 'provider_id')

      const filter: any = scopedFilter(user, { deletedAt: null })
      if (search) filter.Ref = { $regex: escapeRegex(search), $options: 'i' }
      if (paymentStatus && ['paid', 'partial', 'unpaid'].includes(paymentStatus)) {
        filter.payment_status = paymentStatus
      }
      if (status) filter.status = status
      if (warehouseId) filter.warehouse_id = warehouseId
      if (partyId) filter[type === 'sale' ? 'client_id' : 'provider_id'] = partyId
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
        Model.find(filter)
          .populate(type === 'sale' ? 'client_id' : 'provider_id', 'name')
          .populate('warehouse_id', 'name')
          .populate('user_id', 'name')
          .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Model.countDocuments(filter),
      ])
      return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
    }),

    POST: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, addPerm)
      await dbConnect()

      const body = canonicalCommercialDocument(await req.json())
      const validStatuses = type === 'sale' ? ['received', 'pending'] : ['completed', 'pending']
      if (!validStatuses.includes(body.status)) throw new ApiError(422, 'Invalid return status')
      if (type === 'sale' && !body.client_id) throw new ApiError(422, 'Customer is required')
      if (type === 'purchase' && !body.provider_id) throw new ApiError(422, 'Supplier is required')
      const session = await startTransactionSession()

      try {
        const Ref = await nextReference(refType, Model, session)
        const [ret] = await Model.create([{
          ...body,
          Ref,
          user_id: user.id,
          paid_amount: 0,
          payment_status: 'unpaid',
        }], { session })
        await applyReturnEffect(ret, type, 'apply', session)

        await session.commitTransaction()
        return NextResponse.json(ret, { status: 201 })
      } catch (err) {
        await session.abortTransaction()
        throw err
      } finally {
        session.endSession()
      }
    }),

    DELETE: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      if (deletePerm) await requirePermission(user, deletePerm)
      await dbConnect()
      const ids = await parseBulkIds(req)

      const session = await startTransactionSession()
      try {
        const returns = await Model.find(scopedFilter(user, { _id: { $in: ids }, deletedAt: null })).session(session)
        for (const ret of returns) {
          await applyReturnEffect(ret, type, 'reverse', session)
          ret.deletedAt = new Date()
        await (type === 'sale' ? PaymentSaleReturn : PaymentPurchaseReturn).updateMany({ [type === 'sale' ? 'sale_return_id' : 'purchase_return_id']: ret._id, deletedAt: null }, { deletedAt: ret.deletedAt }, { session })
          await ret.save({ session })
        }
        await session.commitTransaction()
        return NextResponse.json({ message: `${returns.length} returns deleted`, count: returns.length })
      } catch (err) {
        await session.abortTransaction()
        throw err
      } finally {
        session.endSession()
      }
    }),
  }
}

// Factory for GET/PUT/DELETE single item route
export function makeSingleRoute(type: ReturnType, viewPerm: string, editPerm: string, deletePerm: string) {
  const Model = getModel(type)

  return {
    GET: withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, viewPerm)
      await dbConnect()
      const ret = await Model.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null }))
        .populate(type === 'sale' ? 'client_id' : 'provider_id', 'name email phone')
        .populate('warehouse_id', 'name')
        .populate('user_id', 'name')
        .populate('details.product_id', 'name code')
        .populate('details.unit_id', 'name short_name')
      if (!ret) throw new ApiError(404, 'Return not found')
      return NextResponse.json(ret)
    }),

    PUT: withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, editPerm)
      await dbConnect()

      const body = canonicalCommercialDocument(await req.json())
      const validStatuses = type === 'sale' ? ['received', 'pending'] : ['completed', 'pending']
      if (!validStatuses.includes(body.status)) throw new ApiError(422, 'Invalid return status')
      if (type === 'sale' && !body.client_id) throw new ApiError(422, 'Customer is required')
      if (type === 'purchase' && !body.provider_id) throw new ApiError(422, 'Supplier is required')
      const session = await startTransactionSession()

      try {
        const ret = await Model.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
        if (!ret) throw new ApiError(404, 'Return not found')

        const previous = ret.toObject()
        if (ret.paid_amount > body.GrandTotal + 0.005) {
          throw new ApiError(409, 'The new total cannot be less than payments already recorded')
        }
        Object.assign(ret, {
          ...body,
          user_id: ret.user_id,
          Ref: ret.Ref,
          paid_amount: ret.paid_amount,
          payment_status: calcPaymentStatus(ret.paid_amount, body.GrandTotal),
        })
        await ret.save({ session })
        await reconcileStockEffects(previous, ret, type === 'sale' ? 'sale-return' : 'purchase-return', session)

        await session.commitTransaction()
        return NextResponse.json(ret)
      } catch (err) {
        await session.abortTransaction()
        throw err
      } finally {
        session.endSession()
      }
    }),

    DELETE: withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, deletePerm)
      await dbConnect()

      const session = await startTransactionSession()

      try {
        const ret = await Model.findOne(scopedFilter(user, { _id: ctx.params.id, deletedAt: null })).session(session)
        if (!ret) throw new ApiError(404, 'Return not found')

        await applyReturnEffect(ret, type, 'reverse', session)
        ret.deletedAt = new Date()
        await (type === 'sale' ? PaymentSaleReturn : PaymentPurchaseReturn).updateMany({ [type === 'sale' ? 'sale_return_id' : 'purchase_return_id']: ret._id, deletedAt: null }, { deletedAt: ret.deletedAt }, { session })
        await ret.save({ session })

        await session.commitTransaction()
        return NextResponse.json({ message: 'Return deleted' })
      } catch (err) {
        await session.abortTransaction()
        throw err
      } finally {
        session.endSession()
      }
    }),
  }
}




