import { makePaymentRoute } from '../_helpers'
const { GET, POST } = makePaymentRoute('purchase-return', 'payment_returns_add', 'payment_returns_view')
export { GET, POST }
