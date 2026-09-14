import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/permissions'

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSession()
  } catch {
    redirect('/login')
  }
  return children
}
