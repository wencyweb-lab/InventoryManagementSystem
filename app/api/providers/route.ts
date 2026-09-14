import Provider from '@/models/Provider'
import { peopleCollection } from '../_people'
const { GET, POST, DELETE } = peopleCollection(Provider, 'provider', 'Suppliers_view', 'Suppliers_add', 'Suppliers_delete')
export { GET, POST, DELETE }
