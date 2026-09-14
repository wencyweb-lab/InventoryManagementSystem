import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, scopedFilter, withErrorHandler } from '@/lib/permissions'
import { sendConfiguredEmail } from '@/lib/mailer'
import { sendConfiguredSms } from '@/lib/sms'
import CommunicationLog from '@/models/CommunicationLog'
import Sale from '@/models/Sale'
import Purchase from '@/models/Purchase'
import Quotation from '@/models/Quotation'
import { PurchaseReturn, SaleReturn } from '@/models/Returns'
import { PaymentSale, PaymentPurchase, PaymentSaleReturn, PaymentPurchaseReturn } from '@/models/Payments'
import '@/models/Product'
import '@/models/Client'
import '@/models/Provider'
import '@/models/Warehouse'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  channel: z.enum(['email', 'sms']),
  resource: z.enum(['sale', 'purchase', 'quotation', 'sale-return', 'purchase-return', 'payment-sale', 'payment-purchase', 'payment-sale-return', 'payment-purchase-return']),
  document_id: z.string().regex(/^[a-f\d]{24}$/i),
  idempotency_key: z.string().uuid().optional(),
})

const CONFIG = {
  sale: { model: Sale, permission: 'Sales_view', party: 'client_id', label: 'Sale' },
  purchase: { model: Purchase, permission: 'Purchases_view', party: 'provider_id', label: 'Purchase' },
  quotation: { model: Quotation, permission: 'Quotations_view', party: 'client_id', label: 'Quotation' },
  'sale-return': { model: SaleReturn, permission: 'Sale_Returns_view', party: 'client_id', label: 'Sale return' },
  'purchase-return': { model: PurchaseReturn, permission: 'Purchase_Returns_view', party: 'provider_id', label: 'Purchase return' },
  'payment-sale': { model: PaymentSale, permission: 'payment_sales_view', party: 'client_id', label: 'Sale payment', parent: Sale, parentField: 'sale_id' },
  'payment-purchase': { model: PaymentPurchase, permission: 'payment_purchases_view', party: 'provider_id', label: 'Purchase payment', parent: Purchase, parentField: 'purchase_id' },
  'payment-sale-return': { model: PaymentSaleReturn, permission: 'payment_returns_view', party: 'client_id', label: 'Sale return payment', parent: SaleReturn, parentField: 'sale_return_id' },
  'payment-purchase-return': { model: PaymentPurchaseReturn, permission: 'payment_returns_view', party: 'provider_id', label: 'Purchase return payment', parent: PurchaseReturn, parentField: 'purchase_return_id' },
} as const

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function mask(value: string) {
  if (value.includes('@')) { const [name, domain] = value.split('@'); return `${name.slice(0, 2)}***@${domain}` }
  return value.length > 4 ? `${'*'.repeat(value.length - 4)}${value.slice(-4)}` : '****'
}

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireSession()
  const body = requestSchema.parse(await request.json())
  const config: any = CONFIG[body.resource]
  await requirePermission(user, config.permission)
  await dbConnect()

  const idempotencyKey = body.idempotency_key ?? randomUUID()
  const existing: any = await CommunicationLog.findOne({ idempotency_key: idempotencyKey }).lean()
  let document: any
  if (config.parent) {
    const payment = await config.model.findOne({ _id: body.document_id, deletedAt: null }).lean()
    if (!payment) throw new ApiError(404, 'Payment not found')
    const parent = await config.parent.findOne(scopedFilter(user, { _id: payment[config.parentField], deletedAt: null })).populate(config.party, 'name email phone').lean()
    if (!parent) throw new ApiError(404, 'Payment not found')
    document = { ...payment, [config.party]: parent[config.party], GrandTotal: payment.montant, details: [], parentRef: parent.Ref }
  } else {
    document = await config.model.findOne(scopedFilter(user, { _id: body.document_id, deletedAt: null }))
      .populate(`${config.party} warehouse_id details.product_id`, 'name email phone code').lean()
  }
  if (!document) throw new ApiError(404, `${config.label} not found`)
  if (existing && (String(existing.user_id) !== user.id || existing.resource !== body.resource || String(existing.document_id) !== body.document_id || existing.channel !== body.channel)) throw new ApiError(409, 'Communication key is already in use')
  if (existing?.status === 'sent') return NextResponse.json({ message: 'Already sent', provider_id: existing.provider_id })
  if (existing) throw new ApiError(409, 'This communication request is already being processed or previously failed')
  const party = document[config.party]
  const recipient = body.channel === 'email' ? party?.email : party?.phone
  if (!recipient) throw new ApiError(422, `${body.channel === 'email' ? 'Email address' : 'Phone number'} is missing on the saved party record`)

  const log: any = await CommunicationLog.create({ idempotency_key: idempotencyKey, channel: body.channel, resource: body.resource, document_id: document._id, user_id: user.id, recipient_masked: mask(recipient) })
  const subject = `${config.label} ${document.Ref}${document.parentRef ? ` for ${document.parentRef}` : ''}`
  const lines = (document.details ?? []).map((line: any) => `${line.product_id?.name ?? 'Product'} x ${line.quantity}: ${Number(line.subtotal ?? 0).toFixed(2)}`)
  const text = `${subject}\nDate: ${new Date(document.date).toLocaleDateString()}\n${lines.join('\n')}\nTotal: ${Number(document.GrandTotal ?? 0).toFixed(2)}`
  const html = `<h1>${escapeHtml(subject)}</h1><p>Date: ${escapeHtml(new Date(document.date).toLocaleDateString())}</p><table>${(document.details ?? []).map((line: any) => `<tr><td>${escapeHtml(line.product_id?.name ?? 'Product')}</td><td>${escapeHtml(line.quantity)}</td><td>${escapeHtml(Number(line.subtotal ?? 0).toFixed(2))}</td></tr>`).join('')}</table><p><strong>Total: ${escapeHtml(Number(document.GrandTotal ?? 0).toFixed(2))}</strong></p>`

  try {
    const providerId = body.channel === 'email'
      ? await sendConfiguredEmail({ to: recipient, subject, text, html })
      : await sendConfiguredSms({ to: recipient, body: `${subject}. Total ${Number(document.GrandTotal ?? 0).toFixed(2)}.` })
    log.status = 'sent'
    log.provider_id = providerId
    await log.save()
    return NextResponse.json({ message: `${body.channel === 'email' ? 'Email' : 'SMS'} sent`, provider_id: providerId })
  } catch (error: any) {
    log.status = 'failed'
    log.error = String(error?.message ?? 'Delivery failed').slice(0, 1000)
    await log.save()
    throw error
  }
})
