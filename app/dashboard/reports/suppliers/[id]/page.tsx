import { PartyReportDetail } from '@/components/reports/PartyReportDetail'
export default function Page({ params }: { params: { id: string } }) { return <PartyReportDetail type="supplier_detail" id={params.id} backPath="/dashboard/reports/suppliers" /> }
