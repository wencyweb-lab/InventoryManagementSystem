import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/permissions'
import DashboardShell from '@/components/layout/DashboardShell'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSession()
  } catch {
    redirect('/login')
  }

  return <DashboardShell>{children}</DashboardShell>
}
