import { TransactionList } from '@/components/transactions/TransactionList'
export default function Page() { return <TransactionList title="Purchase Returns" description="Stock returned to suppliers" endpoint="/api/returns/purchase" basePath="/dashboard/purchase-returns" createLabel="Create Return" exportResource="purchase-returns" paymentEndpoint="/api/payment/purchase-return" /> }
