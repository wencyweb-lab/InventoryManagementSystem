'use client'
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, X } from 'lucide-react'

export type ResourceField = { name: string; label: string; type?: 'text' | 'number' | 'email' | 'textarea'; required?: boolean; defaultValue?: string | number }

export function SimpleResourcePage({ title, description, endpoint, fields }: { title: string; description: string; endpoint: string; fields: ResourceField[] }) {
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const load = useCallback(() => {
    axios.get(endpoint, { params: { limit: 100, search } }).then(({ data }) => {
      setItems(data.data ?? data)
      setSelectedIds([])
    })
  }, [endpoint, search])

  useEffect(() => { load() }, [load])

  function start(item?: any) {
    const next: Record<string, any> = {}
    fields.forEach((field) => { next[field.name] = item?.[field.name] ?? field.defaultValue ?? '' })
    setForm(next)
    setEditing(item ?? null)
    setOpen(true)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    try {
      await axios({ method: editing ? 'put' : 'post', url: editing ? `${endpoint}/${editing._id}` : endpoint, data: form })
      toast.success(`${title.replace(/s$/, '')} saved`)
      setOpen(false)
      load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Save failed')
    }
  }

  async function remove(item: any) {
    if (!confirm(`Delete ${item.name ?? item.code}?`)) return
    try {
      await axios.delete(`${endpoint}/${item._id}`)
      toast.success('Deleted')
      load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Delete failed')
    }
  }

  async function bulkRemove() {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected item(s)?`)) return
    try {
      await axios.delete(endpoint, { data: { ids: selectedIds } })
      toast.success('Deleted selected items')
      setSelectedIds([])
      load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Bulk delete failed')
    }
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i._id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <button onClick={() => start()} className="button-primary">
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            className="form-input w-full"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20 text-sm animate-fade-in">
            <span><strong>{selectedIds.length}</strong> selected</span>
            <button
              onClick={bulkRemove}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Selected
            </button>
          </div>
        )}
      </div>

      <div className="data-table-shell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 w-10 px-4 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer align-middle"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              {fields.slice(0, 4).map((field) => (
                <th key={field.name} className="h-10 px-4 text-left text-xs font-medium">
                  {field.label}
                </th>
              ))}
              <th className="h-10 px-4 text-right text-xs font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr
                  key={item._id}
                  className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${
                    selectedIds.includes(item._id) ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer align-middle"
                      checked={selectedIds.includes(item._id)}
                      onChange={() => toggleSelect(item._id)}
                      aria-label="Select row"
                    />
                  </td>
                  {fields.slice(0, 4).map((field) => (
                    <td key={field.name} className="px-4 py-3">
                      {String(item[field.name] ?? '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => start(item)} className="table-action-btn text-warning">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(item)} className="table-action-btn text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={fields.slice(0, 4).length + 2} className="p-12 text-center text-muted-foreground">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
          <form onSubmit={save} className="w-full max-w-lg space-y-5 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'Create'} {title.replace(/s$/, '')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Complete the fields below and save your changes.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="table-action-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-px bg-border" />
            {fields.map((field) => (
              <div key={field.name}>
                <label className="input-label">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    value={form[field.name]}
                    onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    className="form-input min-h-24 w-full"
                  />
                ) : (
                  <input
                    required={field.required}
                    type={field.type ?? 'text'}
                    value={form[field.name]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                      })
                    }
                    className="form-input w-full"
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="button-outline">
                Cancel
              </button>
              <button className="button-primary">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
