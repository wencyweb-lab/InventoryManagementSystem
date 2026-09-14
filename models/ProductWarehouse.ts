import mongoose, { Schema, Document, Types } from 'mongoose'

/**
 * THE STOCK TRUTH TABLE.
 * One row per (product, warehouse, variant?).
 * `qte` is always stored in the product's BASE unit.
 * Use toBaseQty() / fromBaseQty() from lib/calculations.ts for all mutations.
 */
export interface IProductWarehouse extends Document {
  product_id: Types.ObjectId
  warehouse_id: Types.ObjectId
  variant_id: Types.ObjectId | null // null = non-variant product
  qte: number                        // base-unit stock balance
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ProductWarehouseSchema = new Schema<IProductWarehouse>(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    variant_id: { type: Schema.Types.ObjectId, default: null },
    qte: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

ProductWarehouseSchema.index(
  { product_id: 1, warehouse_id: 1, variant_id: 1, deletedAt: 1 },
  { unique: true, name: 'unique_live_stock_identity' }
)

export default mongoose.models.ProductWarehouse ||
  mongoose.model<IProductWarehouse>('ProductWarehouse', ProductWarehouseSchema)
