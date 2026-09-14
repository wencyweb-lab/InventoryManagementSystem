import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IUnit extends Document {
  name: string
  short_name: string
  operator: '*' | '/'
  operator_value: number
  base_unit: Types.ObjectId | null // null = this IS the base unit
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const UnitSchema = new Schema<IUnit>(
  {
    name: { type: String, required: true },
    short_name: { type: String, required: true },
    operator: { type: String, enum: ['*', '/'], default: '*' },
    operator_value: { type: Number, default: 1 },
    base_unit: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Unit || mongoose.model<IUnit>('Unit', UnitSchema)
