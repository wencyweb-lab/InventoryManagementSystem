'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'

export function ExportButton({ resource, label = 'Excel' }: { resource: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  async function download() {
    setLoading(true)
    try {
      const response = await fetch(`/api/exports/${resource}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message ?? 'Export failed')
      }
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${resource}.xlsx`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      toast.error(error.message ?? 'Export failed')
    } finally {
      setLoading(false)
    }
  }
  return <button type="button" onClick={download} disabled={loading} className="button-outline"><Download className="h-4 w-4" />{loading ? 'Exporting…' : label}</button>
}
