'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDate, formatCurrency } from '@/lib/utils'

export function PaymentReceipt({ type, id }: { type: string; id: string }) {
  const [payment, setPayment] = useState<any>()
  const [company, setCompany] = useState<any>({})
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([axios.get(`/api/payment/${type}/${id}`, { signal: controller.signal }), axios.get('/api/settings', { signal: controller.signal })])
      .then(([receipt, settings]) => { setPayment(receipt.data); setCompany(settings.data) })
      .catch(reason => { if (!axios.isCancel(reason)) setError(reason.response?.data?.message || 'Unable to load receipt') })
    return () => controller.abort()
  }, [type, id])
  async function send(channel: 'email' | 'sms') {
    setSending(true)
    try { const { data } = await axios.post('/api/communications', { channel, resource: `payment-${type}`, document_id: id, idempotency_key: crypto.randomUUID() }); toast.success(data.message) }
    catch (reason: any) { toast.error(reason.response?.data?.message || 'Delivery failed') }
    finally { setSending(false) }
  }
  if (error) return <p role="alert">{error}</p>
  if (!payment) return <p>Loading receipt...</p>
  const document = payment.document
  const party = document.client_id ?? document.provider_id
  const documentModule = { sale: 'sales', purchase: 'purchases', 'sale-return': 'sale-returns', 'purchase-return': 'purchase-returns' }[type]
  const money = (amount: number) => formatCurrency(amount, company.currency_id?.symbol || '$')
  return <article className="print-document mx-auto max-w-3xl space-y-6">
    <div className="flex flex-wrap gap-3 print:hidden"><Link href={`/dashboard/${documentModule}/${document._id}`} className="button-outline">Back to document</Link><button onClick={() => window.print()} className="button-outline">Print / PDF</button><button disabled={sending} onClick={() => send('email')} className="button-outline">Email</button><button disabled={sending} onClick={() => send('sms')} className="button-outline">SMS</button></div>
    <header className="space-y-2"><h1 className="page-title">Payment receipt {payment.Ref}</h1><h2 className="text-lg font-semibold">{company.CompanyName}</h2><p>{company.CompanyAdress}</p><p>{company.email} {company.CompanyPhone}</p></header>
    <dl className="form-section space-y-3"><div className="detail-row"><dt>Date</dt><dd>{formatDate(payment.date)}</dd></div><div className="detail-row"><dt>Document</dt><dd>{document.Ref}</dd></div><div className="detail-row"><dt>Customer / supplier</dt><dd>{party?.name}</dd></div><div className="detail-row"><dt>Method</dt><dd>{payment.payment_method}</dd></div><div className="detail-row"><dt>Amount</dt><dd>{money(payment.montant)}</dd></div><div className="detail-row"><dt>Change</dt><dd>{money(payment.change ?? 0)}</dd></div></dl>
    {payment.notes && <p className="whitespace-pre-wrap">{payment.notes}</p>}<footer>{company.footer}</footer>
  </article>
}
