'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
export function ExpenseForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    date: initialData ? new Date(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    warehouse_id: initialData?.warehouse_id?._id ?? initialData?.warehouse_id ?? '',
    category_id: initialData?.category_id?._id ?? initialData?.category_id ?? '',
    amount: initialData?.amount ?? 0,
    details: initialData?.details ?? '',
  })
  useEffect(() => { Promise.all([axios.get('/api/warehouses?all=true'), axios.get('/api/expense-categories?all=true')]).then(([warehousesResponse, categoriesResponse]) => { setWarehouses(warehousesResponse.data); setCategories(categoriesResponse.data) }) }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true)
    try { await axios({ method: initialData?._id ? 'put' : 'post', url: initialData?._id ? `/api/expenses/${initialData._id}` : '/api/expenses', data: form }); toast.success('Expense saved'); router.push('/dashboard/expenses'); router.refresh() }
    catch (error: any) { toast.error(error.response?.data?.message ?? 'Unable to save expense') }
    finally { setLoading(false) }
  }
  return <form onSubmit={submit} className="form-section mx-auto max-w-3xl space-y-5"><div className="grid gap-5 md:grid-cols-2"><div><label className="input-label">Date</label><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="form-input w-full" /></div><div><label className="input-label">Amount</label><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="form-input w-full" /></div><div><label className="input-label">Warehouse</label><select required value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="form-input w-full"><option value="">Select warehouse</option>{warehouses.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div><div><label className="input-label">Category</label><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="form-input w-full"><option value="">Select category</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div><div className="md:col-span-2"><label className="input-label">Details</label><textarea required value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="form-input min-h-28 w-full" /></div></div><div className="flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="rounded-lg border px-5 py-2.5">Cancel</button><button disabled={loading} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground">{loading ? 'Saving…' : 'Save Expense'}</button></div></form>
}
