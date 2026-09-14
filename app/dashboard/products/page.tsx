'use client'
import { useEffect, useState, useMemo } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { Plus, Edit, Trash2, Eye, Barcode, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import { formatCurrency } from '@/lib/utils'
import { createColumnHelper } from '@tanstack/react-table'
import { ExportButton } from '@/components/shared/ExportButton'
import { ImportButton } from '@/components/shared/ImportButton'

import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<any>()

export default function ProductsPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchProducts = async (p = page, q = search) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/products?page=${p}&limit=15&search=${q}`)
      setData(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setLastPage(res.data.last_page)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts(1, search) }, [search])
  useEffect(() => { fetchProducts(page, search) }, [page])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await axios.delete(`/api/products/${id}`)
      toast.success('Product deleted')
      fetchProducts()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error deleting product')
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await axios.delete('/api/products', { data: { ids } })
      toast.success('Selected products deleted')
      fetchProducts()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error deleting products')
    }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('image', {
      header: 'Image',
      cell: info => (
        <div className="w-10 h-10 rounded bg-secondary/50 border border-border flex items-center justify-center overflow-hidden shrink-0">
          {info.getValue() === 'no-image.png' ? (
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          ) : (
            <img src={`/uploads/products/${info.getValue()}`} alt="product" className="w-full h-full object-cover" />
          )}
        </div>
      )
    }),
    columnHelper.accessor('name', {
      header: 'Product',
      cell: info => (
        <div>
          <p className="font-medium text-foreground">{info.getValue()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{info.row.original.code}</p>
        </div>
      )
    }),
    columnHelper.accessor('category_id.name', { header: 'Category' }),
    columnHelper.accessor('brand_id.name', { header: 'Brand', cell: i => i.getValue() || '-' }),
    columnHelper.accessor('price', { header: 'Price', cell: i => formatCurrency(i.getValue()) }),
    columnHelper.accessor('unit_id.short_name', { header: 'Unit' }),
    columnHelper.accessor('current_stock', {
      header: 'Stock',
      cell: info => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{info.getValue()}</span>
          {info.getValue() <= info.row.original.alert_quantity && (
            <span className="badge-danger">Low</span>
          )}
        </div>
      )
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: info => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/products/barcode?id=${info.row.original._id}`} className="table-action-btn flex items-center justify-center text-muted-foreground hover:text-foreground" title="Print Barcode">
            <Barcode className="w-4 h-4" />
          </Link>
          <Link href={`/dashboard/products/${info.row.original._id}`} className="table-action-btn flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10">
            <Eye className="w-4 h-4" />
          </Link>
          <Link href={`/dashboard/products/${info.row.original._id}/edit`} className="table-action-btn flex items-center justify-center text-warning/80 hover:text-warning hover:bg-warning/10">
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
          <h1 className="page-title">Products</h1>
          <p className="page-description">Manage your inventory products and services</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton resource="products" />
          <ImportButton resource="products" sample="/samples/products.csv" onImported={() => fetchProducts(1, search)} />
          <Link href="/dashboard/products/create" className="button-primary">
            <Plus className="w-4 h-4" /> Create Product
          </Link>
        </div>
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
        onBulkDelete={handleBulkDelete}
      />
    </div>
  )
}
