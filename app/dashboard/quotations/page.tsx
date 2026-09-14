'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2, Eye, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { createColumnHelper } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ExportButton } from '@/components/shared/ExportButton'

const columnHelper = createColumnHelper<any>()

export default function QuotationsPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchQuotations = useCallback(async (p = page, q = search) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: p, limit: 15, search: q }
      if (status) params.status = status
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await axios.get('/api/quotations', { params })
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally { setLoading(false) }
  }, [page, search, status, dateFrom, dateTo])

  useEffect(() => {
    fetchQuotations(page, search)
  }, [fetchQuotations, page, search])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return
    try {
      await axios.delete(`/api/quotations/${id}`)
      toast.success('Quotation deleted')
      fetchQuotations()
    } catch (err) { toast.error('Error deleting quotation') }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/quotations', { data: { ids } })
      toast.success('Selected quotations deleted')
      fetchQuotations()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting quotations') }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('date', { header: 'Date', cell: i => formatDateTime(i.getValue()) }),
    columnHelper.accessor('Ref', { header: 'Reference', cell: i => <span className="font-medium text-foreground">{i.getValue()}</span> }),
    columnHelper.accessor('client_id.name', { header: 'Customer', cell: i => i.getValue() || '-' }),
    columnHelper.accessor('warehouse_id.name', { header: 'Warehouse' }),
    columnHelper.accessor('status', { header: 'Status', cell: i => <StatusBadge status={i.getValue()} /> }),
    columnHelper.accessor('GrandTotal', { header: 'Grand Total', cell: i => <span className="font-bold">{formatCurrency(i.getValue())}</span> }),
    columnHelper.display({
      id: 'actions', header: 'Actions',
      cell: info => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/sales/create?quotation=${info.row.original._id}`} className="table-action-btn flex items-center justify-center text-success/80 hover:text-success hover:bg-success/10" title="Create Sale">
            <CheckCircle className="w-4 h-4" />
          </Link>
          <Link href={`/dashboard/quotations/${info.row.original._id}`} className="table-action-btn flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary" title="Print or save PDF">
            <FileText className="w-4 h-4" />
          </Link>
          <Link href={`/dashboard/quotations/${info.row.original._id}`} className="table-action-btn flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10" title="View details">
            <Eye className="w-4 h-4" />
          </Link>
          <Link href={`/dashboard/quotations/${info.row.original._id}/edit`} className="table-action-btn flex items-center justify-center text-warning/80 hover:text-warning hover:bg-warning/10" title="Edit">
            <Edit className="w-4 h-4" />
          </Link>
          <button onClick={() => handleDelete(info.row.original._id)} className="table-action-btn text-destructive/80 hover:text-destructive hover:bg-destructive/10" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    })
  ], [fetchQuotations])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage customer quotes</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton resource="quotations" />
          <Link href="/dashboard/quotations/create" className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Create Quotation
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-4 form-section">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="form-input h-9 py-1 text-sm pr-8"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            className="form-input h-9 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            className="form-input h-9 py-1 text-sm"
          />
        </div>
        {(status || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setStatus('')
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        lastPage={lastPage}
        loading={loading}
        onPageChange={setPage}
        onSearch={(s) => {
          setSearch(s)
          setPage(1)
        }}
        searchPlaceholder="Search by Reference..."
        onBulkDelete={handleBulkDelete}
      />
    </div>
  )
}
