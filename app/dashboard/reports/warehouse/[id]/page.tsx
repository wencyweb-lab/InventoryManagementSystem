import { PartyReportDetail } from '@/components/reports/PartyReportDetail'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PartyReportDetail type="warehouse_detail" id={id} backPath="/dashboard/reports/warehouse" />
}
