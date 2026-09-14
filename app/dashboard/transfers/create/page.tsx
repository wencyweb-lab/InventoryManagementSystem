'use client'
import { TransferForm } from '@/components/forms/TransferForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CreateTransferPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/transfers" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Transfer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Transfer stock between warehouses</p>
        </div>
      </div>
      <TransferForm />
    </div>
  )
}
