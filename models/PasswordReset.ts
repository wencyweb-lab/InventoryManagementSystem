import mongoose, { Schema, Document } from 'mongoose'

export interface IPasswordReset extends Document {
  email: string
  token: string
  createdAt: Date
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    email: { type: String, required: true, index: true },
    token: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 }, // 1 hour TTL index in MongoDB
  },
  { timestamps: false }
)

export default mongoose.models.PasswordReset ||
  mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema)
