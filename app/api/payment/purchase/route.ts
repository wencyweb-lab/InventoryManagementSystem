import { makePaymentRoute } from '../_helpers'
const { GET, POST } = makePaymentRoute('purchase', 'payment_purchases_add', 'payment_purchases_view')
export { GET, POST }
