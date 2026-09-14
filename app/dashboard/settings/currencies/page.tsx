import { SimpleResourcePage } from '@/components/settings/SimpleResourcePage'
export default function Page() { return <SimpleResourcePage title="Currencies" description="Currency display metadata" endpoint="/api/currencies" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'code', label: 'ISO code', required: true }, { name: 'symbol', label: 'Symbol', required: true }]} /> }
