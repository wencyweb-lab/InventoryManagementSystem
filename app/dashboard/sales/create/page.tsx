'use client'
import { TransactionForm } from '@/components/forms/TransactionForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function CreateSalePage() {
  const quotation = useSearchParams().get('quotation')
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/sales" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Sale</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add a new sales order</p>
        </div>
      </div>
      <TransactionForm type="sale" preloadUrl={quotation ? `/api/quotations/${quotation}/convert` : undefined} />
    </div>
  )
}
