'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/adjustments/${id}`} backPath="/dashboard/adjustments" editPath={`/dashboard/adjustments/${id}/edit`} title="Adjustment" /> }
