'use client'
import { useParams } from 'next/navigation'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
export default function Page() { const { id } = useParams(); return <TransactionEditor endpoint={`/api/sales/${id}`} backPath="/dashboard/sales" type="sale" title="Edit Sale" /> }
