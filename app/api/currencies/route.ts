import Currency from '@/models/Currency'
import { currencySchema } from '@/lib/validation'
import { simpleCollection } from '../_simple-resource'
const { GET, POST, DELETE } = simpleCollection({ model: Currency, permission: 'currency', schema: currencySchema, label: 'Currency' })
export { GET, POST, DELETE }
