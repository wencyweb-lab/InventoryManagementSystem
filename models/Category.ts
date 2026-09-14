import mongoose, { Schema, Document } from 'mongoose'

export interface ICategory extends Document {
  code: string
  name: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const CategorySchema = new Schema<ICategory>(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

CategorySchema.index({ code: 1, deletedAt: 1 }, { unique: true })

export default mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema)
