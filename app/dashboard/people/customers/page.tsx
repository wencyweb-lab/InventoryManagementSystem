'use client'
import { useEffect, useState, useMemo } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2 } from 'lucide-react'
import axios from 'axios'
import { createColumnHelper } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { ExportButton } from '@/components/shared/ExportButton'
import { ImportButton } from '@/components/shared/ImportButton'

const columnHelper = createColumnHelper<any>()

export default function CustomersPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchCustomers = async (p = page, q = search) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/clients?page=${p}&limit=15&search=${q}`)
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchCustomers(1, search) }, [search])
  useEffect(() => { fetchCustomers(page, search) }, [page])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return
    try {
      await axios.delete(`/api/clients/${id}`)
      toast.success('Customer deleted')
      fetchCustomers()
    } catch (err) { toast.error('Error deleting customer') }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/clients', { data: { ids } })
      toast.success('Selected customers deleted')
      fetchCustomers()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting customers') }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('code', { header: 'Code', cell: i => <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-secondary text-foreground">{i.getValue() || '-'}</span> }),
    columnHelper.accessor('name', { header: 'Name', cell: i => <span className="font-medium text-foreground">{i.getValue()}</span> }),
    columnHelper.accessor('phone', { header: 'Phone', cell: i => i.getValue() || '-' }),
    columnHelper.accessor('email', { header: 'Email', cell: i => i.getValue() || '-' }),
    columnHelper.accessor('city', { header: 'City', cell: i => i.getValue() || '-' }),
    columnHelper.display({
      id: 'actions', header: 'Actions',
      cell: info => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/people/customers/${info.row.original._id}/edit`} className="table-action-btn flex items-center justify-center text-warning/80 hover:text-warning hover:bg-warning/10">
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
          <h1 className="page-title">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your customer database</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton resource="customers" />
          <ImportButton resource="customers" sample="/samples/customers.csv" onImported={() => fetchCustomers(1, search)} />
          <Link href="/dashboard/people/customers/create" className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Create Customer
          </Link>
        </div>
      </div>
      <DataTable columns={columns} data={data} total={total} page={page} lastPage={lastPage} loading={loading} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search by name, code or phone..." onBulkDelete={handleBulkDelete} />
    </div>
  )
}
