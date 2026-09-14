import mongoose, { Schema, Document } from 'mongoose'

export interface IProvider extends Document {
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

const ProviderSchema = new Schema<IProvider>(
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

ProviderSchema.index({ code: 1, deletedAt: 1 }, { unique: true })

export default mongoose.models.Provider || mongoose.model<IProvider>('Provider', ProviderSchema)
