import mongoose, { Schema, Document } from 'mongoose'

export interface IClient extends Document {
  name: string
  code: string
  email: string
  phone: string
  country: string
  city: string
  address: string
  tax_number: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    code: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    tax_number: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

ClientSchema.index({ code: 1, deletedAt: 1 }, { unique: true })

export default mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema)
