import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IProductVariant {
  _id?: Types.ObjectId
  name: string
  code: string
  deletedAt: Date | null
}

export interface IProduct extends Document {
  code: string
  name: string
  barcode_symbology: string
  category_id: Types.ObjectId | null
  brand_id: Types.ObjectId | null
  unit_id: Types.ObjectId | null       // base unit
  sale_unit_id: Types.ObjectId | null
  purchase_unit_id: Types.ObjectId | null
  cost: number
  price: number
  tax_method: '1' | '2'               // 1=exclusive, 2=inclusive
  TaxNet: number                       // tax rate %
  note: string
  image: string
  images: string[]
  is_variant: boolean
  has_alert: boolean
  alert_quantity: number
  variants: IProductVariant[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ProductVariantSchema = new Schema<IProductVariant>({
  name: { type: String, required: true },
  code: { type: String, required: true },
  deletedAt: { type: Date, default: null },
})

const ProductSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    barcode_symbology: { type: String, default: 'CODE128' },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    brand_id: { type: Schema.Types.ObjectId, ref: 'Brand', default: null },
    unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    sale_unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    purchase_unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    cost: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    tax_method: { type: String, enum: ['1', '2'], default: '1' },
    TaxNet: { type: Number, default: 0 },
    note: { type: String, default: '' },
    image: { type: String, default: 'no-image.png' },
    images: [{ type: String }],
    is_variant: { type: Boolean, default: false },
    has_alert: { type: Boolean, default: false },
    alert_quantity: { type: Number, default: 0 },
    variants: [ProductVariantSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

ProductSchema.index({ code: 1, deletedAt: 1 })
ProductSchema.index({ name: 1 })

export default mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)
