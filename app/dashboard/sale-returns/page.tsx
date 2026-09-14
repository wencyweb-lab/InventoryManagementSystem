import { TransactionList } from '@/components/transactions/TransactionList'
export default function Page() { return <TransactionList title="Sale Returns" description="Customer returns and refunds" endpoint="/api/returns/sale" basePath="/dashboard/sale-returns" createLabel="Create Return" exportResource="sale-returns" paymentEndpoint="/api/payment/sale-return" /> }
