import Brand from '@/models/Brand'
import { brandSchema } from '@/lib/validation'
import { simpleCollection } from '../_simple-resource'
const { GET, POST, DELETE } = simpleCollection({ model: Brand, permission: 'brand', schema: brandSchema, label: 'Brand' })
export { GET, POST, DELETE }
