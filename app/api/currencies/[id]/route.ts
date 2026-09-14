import Currency from '@/models/Currency'
import { currencySchema } from '@/lib/validation'
import { simpleItem } from '../../_simple-resource'
const { GET, PUT, DELETE } = simpleItem({ model: Currency, permission: 'currency', schema: currencySchema, label: 'Currency' })
export { GET, PUT, DELETE }
