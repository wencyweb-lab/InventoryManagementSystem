'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/returns/sale/${id}`} backPath="/dashboard/sale-returns" editPath={`/dashboard/sale-returns/${id}/edit`} title="Sale Return" paymentEndpoint="/api/payment/sale-return" communicationResource="sale-return" /> }
