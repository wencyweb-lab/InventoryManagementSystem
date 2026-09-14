'use client'
import { useEffect, useState, useMemo } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2, Eye, FileText, CreditCard, DollarSign } from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { createColumnHelper } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ExportButton } from '@/components/shared/ExportButton'
import { AddPaymentModal, ViewPaymentsModal } from '@/components/modals/PaymentModals'

const columnHelper = createColumnHelper<any>()

export default function SalesPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Payment modals state
  const [addPaymentTarget, setAddPaymentTarget] = useState<any>(null)
  const [viewPaymentsTarget, setViewPaymentsTarget] = useState<any>(null)

  const fetchSales = async (p = page, q = search) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(p), limit: '15', search: q }
      if (paymentStatus) params.payment_status = paymentStatus
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await axios.get('/api/sales', { params })
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchSales(1, search) }, [search, paymentStatus, dateFrom, dateTo])
  useEffect(() => { fetchSales(page, search) }, [page])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sale? This will revert stock.')) return
    try {
      await axios.delete(`/api/sales/${id}`)
      toast.success('Sale deleted')
      fetchSales()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting sale') }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/sales', { data: { ids } })
      toast.success('Selected sales deleted')
      fetchSales()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting sales') }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('date', { header: 'Date', cell: i => formatDateTime(i.getValue()) }),
    columnHelper.accessor('Ref', { header: 'Reference', cell: i => <span className="font-medium text-foreground">{i.getValue()}</span> }),
    columnHelper.accessor('client_id.name', { header: 'Customer', cell: i => i.getValue() || 'Walk-in' }),
    columnHelper.accessor('warehouse_id.name', { header: 'Warehouse' }),
    columnHelper.accessor('status', { header: 'Status', cell: i => <StatusBadge status={i.getValue()} /> }),
    columnHelper.accessor('GrandTotal', { header: 'Grand Total', cell: i => <span className="font-bold">{formatCurrency(i.getValue())}</span> }),
    columnHelper.accessor('paid_amount', { header: 'Paid', cell: i => formatCurrency(i.getValue()) }),
    columnHelper.accessor('payment_status', { header: 'Payment', cell: i => <StatusBadge status={i.getValue()} /> }),
    columnHelper.display({
      id: 'actions', header: 'Actions',
      cell: info => {
        const row = info.row.original
        const isFullyPaid = row.paid_amount >= row.GrandTotal - 0.01

        return (
          <div className="flex items-center gap-1">
            {!isFullyPaid && (
              <button
                onClick={() => setAddPaymentTarget(row)}
                className="table-action-btn flex items-center justify-center text-success/80 hover:text-success hover:bg-success/10"
                title="Add payment"
              >
                <CreditCard className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setViewPaymentsTarget(row)}
              className="table-action-btn flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10"
              title="View payments"
            >
              <DollarSign className="w-4 h-4" />
            </button>
            <Link href={`/dashboard/sales/${row._id}`} className="table-action-btn flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary" title="View details / PDF">
              <Eye className="w-4 h-4" />
            </Link>
            <Link href={`/dashboard/sales/${row._id}/edit`} className="table-action-btn flex items-center justify-center text-warning/80 hover:text-warning hover:bg-warning/10">
              <Edit className="w-4 h-4" />
            </Link>
            <button onClick={() => handleDelete(row._id)} className="table-action-btn text-destructive/80 hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      }
    })
  ], [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage sales orders and invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton resource="sales" />
          <Link href="/dashboard/sales/create" className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Create Sale
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 form-section">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Payment</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="form-input h-9 py-1 text-sm pr-8"
          >
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input h-9 py-1 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input h-9 py-1 text-sm" />
        </div>
        {(paymentStatus || dateFrom || dateTo) && (
          <button
            onClick={() => { setPaymentStatus(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
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
        onSearch={setSearch}
        searchPlaceholder="Search by Reference..."
        onBulkDelete={handleBulkDelete}
      />

      {/* Payment Modals */}
      <AddPaymentModal
        open={Boolean(addPaymentTarget)}
        onClose={() => setAddPaymentTarget(null)}
        endpoint="/api/payment/sale"
        parentId={addPaymentTarget?._id || ""}
        reference={addPaymentTarget?.Ref || ""}
        grandTotal={addPaymentTarget?.GrandTotal || 0}
        paidAmount={addPaymentTarget?.paid_amount || 0}
        onPaymentAdded={() => fetchSales()}
      />

      <ViewPaymentsModal
        open={Boolean(viewPaymentsTarget)}
        onClose={() => setViewPaymentsTarget(null)}
        endpoint="/api/payment/sale"
        parentId={viewPaymentsTarget?._id || ""}
        reference={viewPaymentsTarget?.Ref || ""}
        grandTotal={viewPaymentsTarget?.GrandTotal || 0}
        onPaymentsChanged={() => fetchSales()}
      />
    </div>
  )
}
