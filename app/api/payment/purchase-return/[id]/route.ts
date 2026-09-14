import { makePaymentSingleRoute } from '../../_helpers'
const { GET, PUT, DELETE } = makePaymentSingleRoute('purchase-return', 'payment_returns_edit', 'payment_returns_delete', 'payment_returns_view')
export { GET, PUT, DELETE }
