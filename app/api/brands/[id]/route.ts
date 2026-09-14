import Brand from '@/models/Brand'
import { brandSchema } from '@/lib/validation'
import { simpleItem } from '../../_simple-resource'
const { GET, PUT, DELETE } = simpleItem({ model: Brand, permission: 'brand', schema: brandSchema, label: 'Brand' })
export { GET, PUT, DELETE }
