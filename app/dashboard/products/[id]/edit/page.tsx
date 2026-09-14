'use client'
import { ProductForm } from '@/components/forms/ProductForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'

export default function EditProductPage() {
  const { id } = useParams()
  const [initialData, setInitialData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/api/products/${id}`)
        setInitialData(res.data.product)
      } catch (err) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProduct()
  }, [id])

  if (loading) return <div className="p-8 text-center animate-pulse text-muted-foreground">Loading product details...</div>
  if (error || !initialData) return <div className="p-8 text-center text-destructive">Failed to load product.</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/products" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Product</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Update details for {initialData.name}</p>
        </div>
      </div>
      <ProductForm initialData={initialData} />
    </div>
  )
}
