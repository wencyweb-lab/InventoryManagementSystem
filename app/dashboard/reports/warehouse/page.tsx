import { ReportPage } from '@/components/reports/ReportPage'
export default function Page() { return <ReportPage title="Warehouse Report" description="Base stock and inventory valuation by warehouse" type="warehouse" rowLinkBase="/dashboard/reports/warehouse" fields={[{ key: 'warehouseName', label: 'Warehouse' }, { key: 'productCount', label: 'Stock rows', format: 'number' }, { key: 'totalStock', label: 'Base stock', format: 'number' }, { key: 'costValue', label: 'Cost value', format: 'currency' }, { key: 'saleValue', label: 'Sale value', format: 'currency' }]} /> }

