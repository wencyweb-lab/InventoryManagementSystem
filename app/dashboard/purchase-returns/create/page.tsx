import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TransactionForm } from '@/components/forms/TransactionForm'
export default function Page() { return <div className="mx-auto max-w-5xl space-y-6"><div className="flex items-center gap-3"><Link href="/dashboard/purchase-returns" className="table-action-btn"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="page-title">Create Purchase Return</h1><p className="text-sm text-muted-foreground">Return warehouse stock to a supplier</p></div></div><TransactionForm type="purchase-return" /></div> }
