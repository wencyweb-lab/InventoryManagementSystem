import Client from '@/models/Client'
import { peopleCollection } from '../_people'
const { GET, POST, DELETE } = peopleCollection(Client, 'client', 'Customers_view', 'Customers_add', 'Customers_delete')
export { GET, POST, DELETE }
