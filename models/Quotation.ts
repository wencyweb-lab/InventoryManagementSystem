import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IQuotationDetail {
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

export interface IQuotation extends Document {
  Ref: string
  date: Date
  client_id: Types.ObjectId | null
  warehouse_id: Types.ObjectId | null
  user_id: Types.ObjectId
  status: 'sent' | 'pending'
  notes: string
  discount: number
  shipping: number
  TaxNet: number
  tax_rate: number
  GrandTotal: number
  details: IQuotationDetail[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const QuotationDetailSchema = new Schema<IQuotationDetail>({
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

const QuotationSchema = new Schema<IQuotation>(
  {
    Ref: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    client_id: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['sent', 'pending'], default: 'pending' },
    notes: { type: String, default: '' },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    TaxNet: { type: Number, default: 0 },
    tax_rate: { type: Number, default: 0 },
    GrandTotal: { type: Number, required: true },
    details: [QuotationDetailSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Quotation || mongoose.model<IQuotation>('Quotation', QuotationSchema)
