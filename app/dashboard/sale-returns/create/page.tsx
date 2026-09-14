import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TransactionForm } from '@/components/forms/TransactionForm'
export default function Page() { return <div className="mx-auto max-w-5xl space-y-6"><div className="flex items-center gap-3"><Link href="/dashboard/sale-returns" className="table-action-btn"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="page-title">Create Sale Return</h1><p className="text-sm text-muted-foreground">Return customer stock to a warehouse</p></div></div><TransactionForm type="sale-return" /></div> }
