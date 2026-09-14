'use client'
import { useEffect, useState } from 'react'; import { useParams } from 'next/navigation'; import axios from 'axios'; import { PersonForm } from '@/components/forms/PersonForm'
export default function Page() { const { id } = useParams(); const [data, setData] = useState<any>(); useEffect(() => { axios.get(`/api/clients/${id}`).then((response) => setData(response.data)) }, [id]); return data ? <div className="space-y-6"><h1 className="page-title">Edit Customer</h1><PersonForm type="customer" initialData={data} /></div> : <div>Loading…</div> }
