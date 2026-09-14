'use client'
import { useParams } from 'next/navigation'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
export default function Page() { const { id } = useParams(); return <TransactionEditor endpoint={`/api/returns/sale/${id}`} backPath="/dashboard/sale-returns" type="sale-return" title="Edit Sale Return" /> }
