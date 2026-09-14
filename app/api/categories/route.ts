import Category from '@/models/Category'
import { categorySchema } from '@/lib/validation'
import { simpleCollection } from '../_simple-resource'
const { GET, POST, DELETE } = simpleCollection({ model: Category, permission: 'category', schema: categorySchema, label: 'Category', select: 'code name' })
export { GET, POST, DELETE }
