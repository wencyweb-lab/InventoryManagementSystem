'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/purchases/${id}`} backPath="/dashboard/purchases" editPath={`/dashboard/purchases/${id}/edit`} title="Purchase" paymentEndpoint="/api/payment/purchase" communicationResource="purchase" /> }
