'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function PaymentGatewayPage() {
  const [form, setForm] = useState<any>()
  useEffect(() => { axios.get('/api/settings/payment-gateway').then(({ data }) => setForm({ provider: 'stripe', enabled: data.enabled ?? false, public_key: data.public_key ?? '', secret_key: '', currency: data.currency ?? 'USD', secret_configured: data.secret_configured ?? false })) }, [])
  if (!form) return <div>Loading…</div>
  async function save(event: React.FormEvent) { event.preventDefault(); try { const { secret_configured, ...payload } = form; const { data } = await axios.put('/api/settings/payment-gateway', payload); setForm({ ...form, secret_key: '', secret_configured: data.secret_configured }); toast.success('Payment gateway settings saved') } catch (error: any) { toast.error(error.response?.data?.message ?? 'Save failed') } }
  return <div className="space-y-6"><div><h1 className="page-title">Payment Gateway</h1><p className="text-sm text-muted-foreground">Stripe credentials are encrypted at rest. Enabling this configuration does not enable live charges until the Stripe adapter is installed and verified.</p></div><form onSubmit={save} className="form-section grid max-w-3xl gap-5 md:grid-cols-2"><label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enable Stripe configuration</label><div><label className="input-label">Publishable key</label><input value={form.public_key} onChange={(e) => setForm({ ...form, public_key: e.target.value })} className="form-input w-full" /></div><div><label className="input-label">Secret key {form.secret_configured && '(configured; leave empty to keep)'}</label><input type="password" value={form.secret_key} onChange={(e) => setForm({ ...form, secret_key: e.target.value })} className="form-input w-full" /></div><div><label className="input-label">Currency</label><input required minLength={3} maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="form-input w-full uppercase" /></div><div className="md:col-span-2 flex justify-end"><button className="rounded-lg bg-primary px-5 py-2.5 text-primary-foreground">Save gateway</button></div></form></div>
}
