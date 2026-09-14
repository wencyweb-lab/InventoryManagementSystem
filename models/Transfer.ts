import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITransferDetail {
  _id?: Types.ObjectId
  product_id: Types.ObjectId
  variant_id: Types.ObjectId | null
  quantity: number
  unit_id: Types.ObjectId | null
  Net_price: number
  subtotal: number
}

export interface ITransfer extends Document {
  Ref: string
  date: Date
  from_warehouse_id: Types.ObjectId
  to_warehouse_id: Types.ObjectId
  user_id: Types.ObjectId
  // sent = remove source stock only
  // completed = remove source + add destination
  // pending = no stock change
  status: 'pending' | 'sent' | 'completed'
  notes: string
  shipping: number
  GrandTotal: number
  details: ITransferDetail[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const TransferDetailSchema = new Schema<ITransferDetail>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant_id: { type: Schema.Types.ObjectId, default: null },
  quantity: { type: Number, required: true },
  unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
  Net_price: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
})

const TransferSchema = new Schema<ITransfer>(
  {
    Ref: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    from_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    to_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'sent', 'completed'], default: 'pending' },
    notes: { type: String, default: '' },
    shipping: { type: Number, default: 0 },
    GrandTotal: { type: Number, default: 0 },
    details: [TransferDetailSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Transfer || mongoose.model<ITransfer>('Transfer', TransferSchema)
