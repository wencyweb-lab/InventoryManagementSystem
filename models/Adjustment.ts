import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IAdjustmentDetail {
  _id?: Types.ObjectId
  product_id: Types.ObjectId
  variant_id: Types.ObjectId | null
  quantity: number // stored as base units directly
  type: 'add' | 'sub'
  cost: number
  subtotal: number
}

export interface IAdjustment extends Document {
  Ref: string
  date: Date
  warehouse_id: Types.ObjectId
  user_id: Types.ObjectId
  notes: string
  details: IAdjustmentDetail[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const AdjustmentDetailSchema = new Schema<IAdjustmentDetail>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant_id: { type: Schema.Types.ObjectId, default: null },
  quantity: { type: Number, required: true },
  type: { type: String, enum: ['add', 'sub'], required: true },
  cost: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
})

const AdjustmentSchema = new Schema<IAdjustment>(
  {
    Ref: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, default: '' },
    details: [AdjustmentDetailSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Adjustment || mongoose.model<IAdjustment>('Adjustment', AdjustmentSchema)
