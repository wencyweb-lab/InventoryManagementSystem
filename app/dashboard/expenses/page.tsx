'use client'
import { useEffect, useState, useMemo } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2, Tag, Calendar } from 'lucide-react'
import axios from 'axios'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { createColumnHelper } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { ExportButton } from '@/components/shared/ExportButton'

const columnHelper = createColumnHelper<any>()

export default function ExpensesPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    axios.get('/api/expense-categories?all=true').then(res => setCategories(res.data)).catch(() => {})
  }, [])

  const fetchExpenses = async (p = page, q = search, cat = selectedCategory, df = dateFrom, dt = dateTo) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '15',
        search: q,
      })
      if (cat) params.set('category_id', cat)
      if (df) params.set('date_from', df)
      if (dt) params.set('date_to', dt)
      const res = await axios.get(`/api/expenses?${params.toString()}`)
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchExpenses(1, search, selectedCategory, dateFrom, dateTo) }, [search, selectedCategory, dateFrom, dateTo])
  useEffect(() => { fetchExpenses(page, search, selectedCategory, dateFrom, dateTo) }, [page])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    try {
      await axios.delete(`/api/expenses/${id}`)
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (err) { toast.error('Error deleting expense') }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/expenses', { data: { ids } })
      toast.success('Selected expenses deleted')
      fetchExpenses()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting expenses') }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('date', { header: 'Date', cell: i => formatDateTime(i.getValue()) }),
    columnHelper.accessor('Ref', { header: 'Reference', cell: i => <span className="font-medium text-foreground">{i.getValue()}</span> }),
    columnHelper.accessor('category_id.name', { header: 'Category', cell: i => i.getValue() || '-' }),
    columnHelper.accessor('warehouse_id.name', { header: 'Warehouse' }),
    columnHelper.accessor('details', { header: 'Details', cell: i => <span className="text-muted-foreground truncate max-w-[200px] block">{i.getValue() || '-'}</span> }),
    columnHelper.accessor('amount', { header: 'Amount', cell: i => <span className="font-bold">{formatCurrency(i.getValue())}</span> }),
    columnHelper.display({
      id: 'actions', header: 'Actions',
      cell: info => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/expenses/${info.row.original._id}/edit`} className="table-action-btn flex items-center justify-center text-warning/80 hover:text-warning hover:bg-warning/10">
            <Edit className="w-4 h-4" />
          </Link>
          <button onClick={() => handleDelete(info.row.original._id)} className="table-action-btn text-destructive/80 hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    })
  ], [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage company expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/expenses/categories" className="h-10 px-3 border border-border rounded-lg flex items-center gap-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Tag className="w-4 h-4 text-muted-foreground" /> Categories
          </Link>
          <ExportButton resource="expenses" />
          <Link href="/dashboard/expenses/create" className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Create Expense
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 form-section">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="form-input text-sm h-9 py-1 px-3"
          >
            <option value="">All Categories</option>
            {categories.map((c: any) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="form-input text-sm h-9 py-1 px-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="form-input text-sm h-9 py-1 px-2"
          />
        </div>
        {(selectedCategory || dateFrom || dateTo) && (
          <button
            onClick={() => { setSelectedCategory(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-primary hover:underline self-center ml-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      <DataTable columns={columns} data={data} total={total} page={page} lastPage={lastPage} loading={loading} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search by Reference..." onBulkDelete={handleBulkDelete} />
    </div>
  )
}
