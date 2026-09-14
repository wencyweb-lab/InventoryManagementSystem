'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/returns/purchase/${id}`} backPath="/dashboard/purchase-returns" editPath={`/dashboard/purchase-returns/${id}/edit`} title="Purchase Return" paymentEndpoint="/api/payment/purchase-return" communicationResource="purchase-return" /> }
