'use client'
import { useParams } from 'next/navigation'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'
export default function Page() { const { id } = useParams(); return <TransactionDetail endpoint={`/api/quotations/${id}`} backPath="/dashboard/quotations" editPath={`/dashboard/quotations/${id}/edit`} title="Quotation" communicationResource="quotation" convertPath={`/api/quotations/${id}/convert`} /> }
