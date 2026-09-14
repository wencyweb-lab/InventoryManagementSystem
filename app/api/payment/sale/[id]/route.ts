import { makePaymentSingleRoute } from '../../_helpers'
const { GET, PUT, DELETE } = makePaymentSingleRoute('sale', 'payment_sales_edit', 'payment_sales_delete', 'payment_sales_view')
export { GET, PUT, DELETE }
