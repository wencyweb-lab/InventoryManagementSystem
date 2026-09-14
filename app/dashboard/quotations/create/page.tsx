'use client'
import { TransactionForm } from '@/components/forms/TransactionForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CreateQuotationPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/quotations" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Quotation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Draft a new quote for a customer</p>
        </div>
      </div>
      <TransactionForm type="quotation" />
    </div>
  )
}
