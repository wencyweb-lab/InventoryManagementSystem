'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import toast from 'react-hot-toast'

export function ImportButton({ resource, sample, onImported }: { resource: 'products' | 'customers' | 'suppliers'; sample: string; onImported?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  async function upload(file?: File) {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/imports/${resource}`, { method: 'POST', body: formData })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.message ?? 'Import failed')
      toast.success(body.message)
      onImported?.()
    } catch (error: any) {
      toast.error(error.message ?? 'Import failed')
    } finally {
      setLoading(false)
      if (input.current) input.current.value = ''
    }
  }
  return <div className="flex items-center gap-2"><a href={sample} download className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Sample CSV</a><button type="button" disabled={loading} onClick={() => input.current?.click()} className="button-outline"><Upload className="h-4 w-4" />{loading ? 'Importing…' : 'Import CSV'}</button><input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => upload(event.target.files?.[0])} /></div>
}
