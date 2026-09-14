import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ISaleDetail {
  _id?: Types.ObjectId
  product_id: Types.ObjectId
  variant_id: Types.ObjectId | null
  quantity: number
  unit_id: Types.ObjectId | null
  unit_price: number
  discount: number
  discount_method: '1' | '2'
  tax_method: '1' | '2'
  tax_percent: number
  tax_net: number
  Net_price: number
  subtotal: number
}

export interface ISale extends Document {
  Ref: string
  date: Date
  client_id: Types.ObjectId | null
  warehouse_id: Types.ObjectId | null
  user_id: Types.ObjectId
  status: 'ordered' | 'pending' | 'completed'
  payment_status: 'paid' | 'partial' | 'unpaid'
  paid_amount: number
  notes: string
  discount: number
  shipping: number
  TaxNet: number
  tax_rate: number
  GrandTotal: number
  is_pos: boolean
  details: ISaleDetail[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const SaleDetailSchema = new Schema<ISaleDetail>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant_id: { type: Schema.Types.ObjectId, default: null },
  quantity: { type: Number, required: true },
  unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
  unit_price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  discount_method: { type: String, enum: ['1', '2'], default: '1' },
  tax_method: { type: String, enum: ['1', '2'], default: '1' },
  tax_percent: { type: Number, default: 0 },
  tax_net: { type: Number, default: 0 },
  Net_price: { type: Number, required: true },
  subtotal: { type: Number, required: true },
})

const SaleSchema = new Schema<ISale>(
  {
    Ref: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    client_id: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['ordered', 'pending', 'completed'], default: 'pending' },
    payment_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
    paid_amount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    TaxNet: { type: Number, default: 0 },
    tax_rate: { type: Number, default: 0 },
    GrandTotal: { type: Number, required: true },
    is_pos: { type: Boolean, default: false },
    details: [SaleDetailSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

SaleSchema.index({ client_id: 1 })
SaleSchema.index({ date: -1 })
SaleSchema.index({ deletedAt: 1 })

export default mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema)
