import mongoose, { Schema, Document } from 'mongoose'

export interface IBrand extends Document {
  name: string
  description: string
  image: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema)
