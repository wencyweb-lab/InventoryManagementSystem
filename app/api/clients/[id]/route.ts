import Client from '@/models/Client'
import { peopleItem } from '../../_people'
const { GET, PUT, DELETE } = peopleItem(Client, 'Customer', 'Customers_view', 'Customers_edit', 'Customers_delete')
export { GET, PUT, DELETE }
