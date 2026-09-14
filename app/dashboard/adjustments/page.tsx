'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import { formatDateTime } from '@/lib/utils'
import { createColumnHelper } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ExportButton } from '@/components/shared/ExportButton'

const columnHelper = createColumnHelper<any>()

export default function AdjustmentsPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchAdjustments = useCallback(async (p = page, q = search) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: p, limit: 15, search: q }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await axios.get('/api/adjustments', { params })
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally { setLoading(false) }
  }, [page, search, dateFrom, dateTo])

  useEffect(() => {
    fetchAdjustments(page, search)
  }, [fetchAdjustments, page, search])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this adjustment? This will revert stock.')) return
    try {
      await axios.delete(`/api/adjustments/${id}`)
      toast.success('Adjustment deleted')
      fetchAdjustments()
    } catch (err) { toast.error('Error deleting adjustment') }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/adjustments', { data: { ids } })
      toast.success('Selected adjustments deleted')
      fetchAdjustments()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting adjustments') }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('date', { header: 'Date', cell: i => formatDateTime(i.getValue()) }),
    columnHelper.accessor('Ref', { header: 'Reference', cell: i => <span className="font-medium text-foreground">{i.getValue()}</span> }),
    columnHelper.accessor('warehouse_id.name', { header: 'Warehouse', cell: i => i.getValue() || '-' }),
    columnHelper.accessor('details', { header: 'Total Items', cell: i => <span className="font-bold">{i.getValue()?.length || 0}</span> }),
    columnHelper.display({
      id: 'actions', header: 'Actions',
      cell: info => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/adjustments/${info.row.original._id}`} className="table-action-btn flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10" title="View details">
            <Eye className="w-4 h-4" />
          </Link>
          <Link href={`/dashboard/adjustments/${info.row.original._id}/edit`} className="table-action-btn flex items-center justify-center text-warning/80 hover:text-warning hover:bg-warning/10" title="Edit">
            <Edit className="w-4 h-4" />
          </Link>
          <button onClick={() => handleDelete(info.row.original._id)} className="table-action-btn text-destructive/80 hover:text-destructive hover:bg-destructive/10" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    })
  ], [fetchAdjustments])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Adjustments</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage stock adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton resource="adjustments" />
          <Link href="/dashboard/adjustments/create" className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Create Adjustment
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-4 form-section">
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
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
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
