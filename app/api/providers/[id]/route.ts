import Provider from '@/models/Provider'
import { peopleItem } from '../../_people'
const { GET, PUT, DELETE } = peopleItem(Provider, 'Supplier', 'Suppliers_view', 'Suppliers_edit', 'Suppliers_delete')
export { GET, PUT, DELETE }
