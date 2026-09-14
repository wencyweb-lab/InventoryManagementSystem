'use client'
import { useParams } from 'next/navigation'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
export default function Page() { const { id } = useParams(); return <TransactionEditor endpoint={`/api/quotations/${id}`} backPath="/dashboard/quotations" type="quotation" title="Edit Quotation" /> }
