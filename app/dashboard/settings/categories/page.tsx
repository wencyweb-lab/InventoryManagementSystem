import { SimpleResourcePage } from '@/components/settings/SimpleResourcePage'
export default function Page() { return <SimpleResourcePage title="Categories" description="Product classification codes" endpoint="/api/categories" fields={[{ name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }]} /> }
