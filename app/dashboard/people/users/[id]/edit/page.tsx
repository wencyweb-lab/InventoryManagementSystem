'use client'
import { useEffect, useState } from 'react'; import { useParams } from 'next/navigation'; import axios from 'axios'; import { UserForm } from '@/components/forms/UserForm'
export default function Page() { const { id } = useParams(); const [data, setData] = useState<any>(); useEffect(() => { axios.get(`/api/users/${id}`).then((response) => setData(response.data)) }, [id]); return data ? <div className="space-y-6"><h1 className="page-title">Edit User</h1><UserForm initialData={data} /></div> : <div>Loading…</div> }
