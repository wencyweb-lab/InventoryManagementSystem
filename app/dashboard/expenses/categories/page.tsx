import { SimpleResourcePage } from '@/components/settings/SimpleResourcePage'
export default function Page() { return <SimpleResourcePage title="Expense Categories" description="Classify operating expenses" endpoint="/api/expense-categories" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'description', label: 'Description', type: 'textarea' }]} /> }
