import { makePaymentRoute } from '../_helpers'
const { GET, POST } = makePaymentRoute('sale', 'payment_sales_add', 'payment_sales_view')
export { GET, POST }
