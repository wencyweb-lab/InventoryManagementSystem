import Unit from '@/models/Unit'
import { unitSchema } from '@/lib/validation'
import { simpleItem } from '../../_simple-resource'
const { GET, PUT, DELETE } = simpleItem({ model: Unit, permission: 'unit', schema: unitSchema, label: 'Unit', populate: 'base_unit' })
export { GET, PUT, DELETE }
