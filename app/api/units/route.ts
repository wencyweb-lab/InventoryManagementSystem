import Unit from '@/models/Unit'
import { unitSchema } from '@/lib/validation'
import { simpleCollection } from '../_simple-resource'
const { GET, POST, DELETE } = simpleCollection({ model: Unit, permission: 'unit', schema: unitSchema, label: 'Unit', populate: 'base_unit' })
export { GET, POST, DELETE }
