'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function SmsSettingsPage() {
  const [form, setForm] = useState<any>()
  useEffect(() => { axios.get('/api/settings/sms').then(({ data }) => setForm({ provider: 'twilio', enabled: data.enabled ?? false, account_sid: data.account_sid ?? '', auth_token: '', from_number: data.from_number ?? '', token_configured: data.token_configured ?? false })) }, [])
  if (!form) return <div>Loading…</div>
  async function save(event: React.FormEvent) { event.preventDefault(); try { const { token_configured, ...payload } = form; const { data } = await axios.put('/api/settings/sms', payload); setForm({ ...form, auth_token: '', token_configured: data.token_configured }); toast.success('SMS settings saved') } catch (error: any) { toast.error(error.response?.data?.message ?? 'Save failed') } }
  return <div className="space-y-6"><div><h1 className="page-title">SMS Configuration</h1><p className="text-sm text-muted-foreground">Twilio credentials are encrypted at rest. Live sending remains disabled until the Twilio delivery adapter is installed and verified.</p></div><form onSubmit={save} className="form-section grid max-w-3xl gap-5 md:grid-cols-2"><label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enable Twilio configuration</label><div><label className="input-label">Account SID</label><input value={form.account_sid} onChange={(e) => setForm({ ...form, account_sid: e.target.value })} className="form-input w-full" /></div><div><label className="input-label">Auth token {form.token_configured && '(configured; leave empty to keep)'}</label><input type="password" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} className="form-input w-full" /></div><div><label className="input-label">From number</label><input value={form.from_number} onChange={(e) => setForm({ ...form, from_number: e.target.value })} placeholder="+15551234567" className="form-input w-full" /></div><div className="md:col-span-2 flex justify-end"><button className="rounded-lg bg-primary px-5 py-2.5 text-primary-foreground">Save SMS settings</button></div></form></div>
}
