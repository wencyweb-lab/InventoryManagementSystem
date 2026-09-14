'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'

export function TransferForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const normalizedInitial = initialData ? {
    ...initialData,
    date: new Date(initialData.date).toISOString().slice(0, 10),
    from_warehouse_id: initialData.from_warehouse_id?._id ?? initialData.from_warehouse_id,
    to_warehouse_id: initialData.to_warehouse_id?._id ?? initialData.to_warehouse_id,
    details: (initialData.details ?? []).map((line: any) => ({
      ...line,
      product_id: line.product_id?._id ?? line.product_id,
      name: line.product_id?.name ?? line.name ?? 'Product',
      unit_id: line.unit_id?._id ?? line.unit_id ?? null,
      variant_id: line.variant_id?._id ?? line.variant_id ?? null,
      current_stock: line.current_stock ?? 0,
    })),
  } : undefined
  const [form, setForm] = useState<any>(normalizedInitial ?? {
    date: new Date().toISOString().slice(0, 10),
    from_warehouse_id: '',
    to_warehouse_id: '',
    status: 'pending',
    notes: '',
    shipping: 0,
    details: [],
  })

  useEffect(() => {
    axios.get('/api/warehouses?all=true').then(({ data }) => setWarehouses(data))
  }, [])

  useEffect(() => {
    if (!form.from_warehouse_id || search.trim().length < 2) return
    const timer = setTimeout(() => {
      axios.get('/api/products', { params: { warehouse_id: form.from_warehouse_id, search, limit: 25 } })
        .then(({ data }) => setProducts(data.data))
    }, 250)
    return () => clearTimeout(timer)
  }, [form.from_warehouse_id, search])

  function addProduct(product: any) {
    if (form.details.some((line: any) => line.product_id === product._id)) return
    setForm((value: any) => ({
      ...value,
      details: [...value.details, {
        product_id: product._id,
        variant_id: null,
        unit_id: product.purchase_unit_id?._id ?? product.unit_id?._id ?? null,
        quantity: 1,
        Net_price: product.cost,
        name: product.name,
        current_stock: product.current_stock,
      }],
    }))
    setSearch('')
    setProducts([])
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.details.length) return toast.error('Add at least one product')
    setLoading(true)
    try {
      const endpoint = initialData?._id ? `/api/transfers/${initialData._id}` : '/api/transfers'
      await axios({ method: initialData?._id ? 'put' : 'post', url: endpoint, data: form })
      toast.success('Transfer saved')
      router.push('/dashboard/transfers')
      router.refresh()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to save transfer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="form-section grid gap-4 md:grid-cols-3">
        <div><label className="input-label">Date</label><input required type="date" value={form.date?.slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} className="form-input w-full" /></div>
        <div><label className="input-label">From warehouse</label><select required value={form.from_warehouse_id} onChange={(e) => setForm({ ...form, from_warehouse_id: e.target.value, details: [] })} className="form-input w-full"><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>)}</select></div>
        <div><label className="input-label">To warehouse</label><select required value={form.to_warehouse_id} onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })} className="form-input w-full"><option value="">Select warehouse</option>{warehouses.filter((warehouse) => warehouse._id !== form.from_warehouse_id).map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>)}</select></div>
        <div><label className="input-label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="form-input w-full"><option value="pending">Pending</option><option value="sent">Sent</option><option value="completed">Completed</option></select></div>
        <div><label className="input-label">Shipping</label><input type="number" min="0" step="0.01" value={form.shipping} onChange={(e) => setForm({ ...form, shipping: Number(e.target.value) })} className="form-input w-full" /></div>
        <div className="md:col-span-3"><label className="input-label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="form-input min-h-20 w-full" /></div>
      </div>
      <div className="form-section">
        <label className="input-label">Products</label>
        <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input disabled={!form.from_warehouse_id} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search source stock" className="form-input w-full pl-9" />{products.length > 0 && <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-2 shadow-xl">{products.map((product) => <button key={product._id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between rounded p-2 text-left hover:bg-secondary"><span>{product.name}</span><span className="text-xs">Stock {product.current_stock} <Plus className="inline h-3 w-3" /></span></button>)}</div>}</div>
        <div className="mt-4 space-y-2">{form.details.map((line: any, index: number) => <div key={line.product_id} className="grid grid-cols-[1fr_120px_100px_36px] items-center gap-3 rounded-lg border p-3"><span>{line.name}</span><input type="number" min="0.0001" step="any" value={line.quantity} onChange={(e) => setForm({ ...form, details: form.details.map((item: any, i: number) => i === index ? { ...item, quantity: Number(e.target.value) } : item) })} className="form-input" /><span className="text-xs text-muted-foreground">Available {line.current_stock}</span><button type="button" onClick={() => setForm({ ...form, details: form.details.filter((_: any, i: number) => i !== index) })} className="text-destructive"><Trash2 className="h-4 w-4" /></button></div>)}</div>
      </div>
      <div className="flex justify-end"><button disabled={loading} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Transfer'}</button></div>
    </form>
  )
}
