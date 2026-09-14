import { notFound } from 'next/navigation'
import { PaymentReceipt } from '@/components/transactions/PaymentReceipt'

export default async function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params
  if (!['sale', 'purchase', 'sale-return', 'purchase-return'].includes(type)) notFound()
  return <PaymentReceipt type={type} id={id} />
}
