'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TransferForm } from '@/components/forms/TransferForm'
import { AdjustmentForm } from '@/components/forms/AdjustmentForm'
export function StockDocumentEditor({ endpoint, backPath, type, title }: { endpoint: string; backPath: string; type: 'transfer' | 'adjustment'; title: string }) {
  const [document, setDocument] = useState<any>()
  const [error, setError] = useState('')
  useEffect(() => { axios.get(endpoint).then(({ data }) => setDocument(data)).catch((reason) => setError(reason.response?.data?.message ?? 'Unable to load document')) }, [endpoint])
  if (error) return <div className="text-destructive">{error}</div>
  if (!document) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>
  return <div className="mx-auto max-w-5xl space-y-6"><div className="flex items-center gap-3"><Link href={backPath} className="table-action-btn"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="page-title">{title}</h1><p className="text-sm text-muted-foreground">{document.Ref}</p></div></div>{type === 'transfer' ? <TransferForm initialData={document} /> : <AdjustmentForm initialData={document} />}</div>
}
