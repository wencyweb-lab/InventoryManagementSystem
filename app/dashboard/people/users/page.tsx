'use client'
import { useEffect, useState, useMemo } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import axios from 'axios'
import { createColumnHelper } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { StatusBadge } from '@/components/shared/StatusBadge'
import Link from 'next/link'

const columnHelper = createColumnHelper<any>()

export default function UsersPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchUsers = async (p = page, q = search) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/users?page=${p}&limit=15&search=${q}`)
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers(1, search) }, [search])
  useEffect(() => { fetchUsers(page, search) }, [page])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      await axios.delete(`/api/users/${id}`)
      toast.success('User deleted')
      fetchUsers()
    } catch (err) { toast.error('Error deleting user') }
  }

  const handleToggleActive = async (user: any) => {
    const newStatut = !user.statut
    const action = newStatut ? 'activate' : 'deactivate'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return
    try {
      await axios.patch(`/api/users/${user._id}/activate`, { statut: newStatut })
      toast.success(`User ${action}d successfully`)
      fetchUsers()
    } catch (err: any) { toast.error(err.response?.data?.message || `Error: could not ${action} user`) }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/users', { data: { ids } })
      toast.success('Selected users deleted')
      fetchUsers()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error deleting users') }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('name', { header: 'Name', cell: i => <span className="font-medium text-foreground">{i.getValue()}</span> }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('roles', { header: 'Roles', cell: i => (i.getValue() || []).map((r: any) => r.name).join(', ') }),
    columnHelper.accessor('statut', { header: 'Status', cell: i => <StatusBadge status={i.getValue() ? 'completed' : 'pending'} /> }),
    columnHelper.display({
      id: 'actions', header: 'Actions',
      cell: info => {
        const user = info.row.original
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleToggleActive(user)}
              className={`table-action-btn flex items-center justify-center ${user.statut ? 'text-warning/80 hover:text-warning hover:bg-warning/10' : 'text-success/80 hover:text-success hover:bg-success/10'}`}
              title={user.statut ? 'Deactivate user' : 'Activate user'}
            >
              {user.statut ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <Link href={`/dashboard/people/users/${user._id}/edit`} className="table-action-btn flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10">
              <Edit className="w-4 h-4" />
            </Link>
            <button onClick={() => handleDelete(user._id)} className="table-action-btn text-destructive/80 hover:text-destructive hover:bg-destructive/10">
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
          <h1 className="page-title">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system access and roles</p>
        </div>
        <Link href="/dashboard/people/users/create" className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Create User
        </Link>
      </div>
      <DataTable columns={columns} data={data} total={total} page={page} lastPage={lastPage} loading={loading} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search users..." onBulkDelete={handleBulkDelete} />
    </div>
  )
}
