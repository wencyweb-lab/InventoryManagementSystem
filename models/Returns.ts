import mongoose, { Schema, Document, Types } from 'mongoose'

const ReturnDetailSchema = new Schema({
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

const baseReturnFields = {
  Ref: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  payment_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
  paid_amount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  discount: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  TaxNet: { type: Number, default: 0 },
  tax_rate: { type: Number, default: 0 },
  GrandTotal: { type: Number, required: true },
  details: [ReturnDetailSchema],
  deletedAt: { type: Date, default: null },
}

// ---- Sale Return ----
// status 'received' → adds stock back
const SaleReturnSchema = new Schema(
  {
    ...baseReturnFields,
    client_id: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    status: { type: String, enum: ['received', 'pending'], default: 'pending' },
  },
  { timestamps: true }
)

// ---- Purchase Return ----
// status 'completed' → subtracts stock
const PurchaseReturnSchema = new Schema(
  {
    ...baseReturnFields,
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    status: { type: String, enum: ['completed', 'pending'], default: 'pending' },
  },
  { timestamps: true }
)

export const SaleReturn =
  mongoose.models.SaleReturn || mongoose.model('SaleReturn', SaleReturnSchema)

export const PurchaseReturn =
  mongoose.models.PurchaseReturn || mongoose.model('PurchaseReturn', PurchaseReturnSchema)
