'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/sales/${id}`} backPath="/dashboard/sales" editPath={`/dashboard/sales/${id}/edit`} title="Sale" paymentEndpoint="/api/payment/sale" communicationResource="sale" /> }
