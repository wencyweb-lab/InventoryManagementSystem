'use client'
import { useParams } from 'next/navigation'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
export default function Page() { const { id } = useParams(); return <TransactionEditor endpoint={`/api/returns/purchase/${id}`} backPath="/dashboard/purchase-returns" type="purchase-return" title="Edit Purchase Return" /> }
