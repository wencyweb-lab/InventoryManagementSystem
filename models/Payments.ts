import mongoose, { Schema, Document, Types } from 'mongoose'

const basePaymentFields = {
  Ref: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  montant: { type: Number, required: true },   // payment amount (legacy field name)
  change: { type: Number, default: 0 },        // cash change given
  payment_method: { type: String, default: 'cash' }, // cash, card, cheque, etc.
  notes: { type: String, default: '' },
  deletedAt: { type: Date, default: null },
}

// Payment for Sales
const PaymentSaleSchema = new Schema(
  {
    ...basePaymentFields,
    sale_id: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
  },
  { timestamps: true }
)

// Payment for Purchases
const PaymentPurchaseSchema = new Schema(
  {
    ...basePaymentFields,
    purchase_id: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true },
  },
  { timestamps: true }
)

// Payment for Sale Returns (customer refund)
const PaymentSaleReturnSchema = new Schema(
  {
    ...basePaymentFields,
    sale_return_id: { type: Schema.Types.ObjectId, ref: 'SaleReturn', required: true },
  },
  { timestamps: true }
)

// Payment for Purchase Returns (supplier refund)
const PaymentPurchaseReturnSchema = new Schema(
  {
    ...basePaymentFields,
    purchase_return_id: { type: Schema.Types.ObjectId, ref: 'PurchaseReturn', required: true },
  },
  { timestamps: true }
)

export const PaymentSale =
  mongoose.models.PaymentSale || mongoose.model('PaymentSale', PaymentSaleSchema)

export const PaymentPurchase =
  mongoose.models.PaymentPurchase || mongoose.model('PaymentPurchase', PaymentPurchaseSchema)

export const PaymentSaleReturn =
  mongoose.models.PaymentSaleReturn || mongoose.model('PaymentSaleReturn', PaymentSaleReturnSchema)

export const PaymentPurchaseReturn =
  mongoose.models.PaymentPurchaseReturn || mongoose.model('PaymentPurchaseReturn', PaymentPurchaseReturnSchema)
