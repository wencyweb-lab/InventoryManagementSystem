'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { ExpenseForm } from '@/components/forms/ExpenseForm'
export default function Page() { const { id } = useParams(); const [document, setDocument] = useState<any>(); useEffect(() => { axios.get(`/api/expenses/${id}`).then(({ data }) => setDocument(data)) }, [id]); if (!document) return <div>Loading…</div>; return <div className="space-y-6"><h1 className="page-title">Edit Expense</h1><ExpenseForm initialData={document} /></div> }
