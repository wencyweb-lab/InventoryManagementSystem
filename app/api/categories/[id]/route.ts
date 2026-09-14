import Category from '@/models/Category'
import { categorySchema } from '@/lib/validation'
import { simpleItem } from '../../_simple-resource'
const { GET, PUT, DELETE } = simpleItem({ model: Category, permission: 'category', schema: categorySchema, label: 'Category' })
export { GET, PUT, DELETE }
