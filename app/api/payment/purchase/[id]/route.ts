import { makePaymentSingleRoute } from '../../_helpers'
const { GET, PUT, DELETE } = makePaymentSingleRoute('purchase', 'payment_purchases_edit', 'payment_purchases_delete', 'payment_purchases_view')
export { GET, PUT, DELETE }
