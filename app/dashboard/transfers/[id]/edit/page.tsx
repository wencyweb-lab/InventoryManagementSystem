'use client'
import { useParams } from 'next/navigation'
import { StockDocumentEditor } from '@/components/transactions/StockDocumentEditor'
export default function Page() { const { id } = useParams(); return <StockDocumentEditor endpoint={`/api/transfers/${id}`} backPath="/dashboard/transfers" type="transfer" title="Edit Transfer" /> }
