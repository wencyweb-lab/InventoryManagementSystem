import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  sessionVersion: number
  resetRequestedAt: Date | null
  phone: string
  avatar: string
  statut: boolean // 1=active, 0=deactivated (matches legacy)
  roles: Types.ObjectId[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    sessionVersion: { type: Number, default: 0 },
    resetRequestedAt: { type: Date, default: null },
    phone: { type: String, default: '' },
    avatar: { type: String, default: 'avatar-default.png' },
    statut: { type: Boolean, default: true },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

UserSchema.index({ email: 1, deletedAt: 1 })

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
