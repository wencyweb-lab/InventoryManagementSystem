'use client'
import { useParams } from 'next/navigation'
import { StockDocumentEditor } from '@/components/transactions/StockDocumentEditor'
export default function Page() { const { id } = useParams(); return <StockDocumentEditor endpoint={`/api/adjustments/${id}`} backPath="/dashboard/adjustments" type="adjustment" title="Edit Adjustment" /> }
