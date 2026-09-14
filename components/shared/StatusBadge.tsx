'use client'
import { cn } from '@/lib/utils'

type Status = 'paid' | 'partial' | 'unpaid' | 'received' | 'completed' | 'ordered' | 'pending' | 'sent'

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  paid:       { label: 'Paid',      className: 'badge-success' },
  partial:    { label: 'Partial',   className: 'badge-warning' },
  unpaid:     { label: 'Unpaid',    className: 'badge-danger'  },
  received:   { label: 'Received',  className: 'badge-success' },
  completed:  { label: 'Completed', className: 'badge-success' },
  ordered:    { label: 'Ordered',   className: 'badge-primary' },
  pending:    { label: 'Pending',   className: 'badge-warning' },
  sent:       { label: 'Sent',      className: 'badge-primary' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status as Status]
  if (!config) return <span className="badge-muted gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}</span>
  return <span className={cn(config.className, 'gap-1.5')}><i className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{config.label}</span>
}
