import mongoose, { Schema, Document } from 'mongoose'

export interface IWarehouse extends Document {
  name: string
  city: string
  country: string
  email: string
  phone: string
  zip: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const WarehouseSchema = new Schema<IWarehouse>(
  {
    name: { type: String, required: true },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    zip: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Warehouse || mongoose.model<IWarehouse>('Warehouse', WarehouseSchema)
