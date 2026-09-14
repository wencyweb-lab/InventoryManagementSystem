import { makeListRoute } from '../_helpers'
const { GET, POST, DELETE } = makeListRoute('sale', 'Sale_Returns_view', 'Sale_Returns_add', 'Sale_Returns_delete')
export { GET, POST, DELETE }
