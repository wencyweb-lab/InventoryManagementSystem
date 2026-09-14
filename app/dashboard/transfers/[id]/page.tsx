'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/transfers/${id}`} backPath="/dashboard/transfers" editPath={`/dashboard/transfers/${id}/edit`} title="Transfer" /> }
