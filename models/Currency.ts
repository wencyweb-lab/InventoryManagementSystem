import mongoose, { Schema, Document } from 'mongoose'

export interface ICurrency extends Document {
  name: string
  code: string
  symbol: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const CurrencySchema = new Schema<ICurrency>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    symbol: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Currency || mongoose.model<ICurrency>('Currency', CurrencySchema)
