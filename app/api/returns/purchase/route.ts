import { makeListRoute } from '../_helpers'
const { GET, POST, DELETE } = makeListRoute('purchase', 'Purchase_Returns_view', 'Purchase_Returns_add', 'Purchase_Returns_delete')
export { GET, POST, DELETE }
