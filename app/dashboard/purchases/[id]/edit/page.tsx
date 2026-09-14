'use client'
import { useParams } from 'next/navigation'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
export default function Page() { const { id } = useParams(); return <TransactionEditor endpoint={`/api/purchases/${id}`} backPath="/dashboard/purchases" type="purchase" title="Edit Purchase" /> }
