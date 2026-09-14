import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IPermission extends Document {
  name: string
  createdAt: Date
  updatedAt: Date
}

const PermissionSchema = new Schema<IPermission>(
  { name: { type: String, required: true, unique: true } },
  { timestamps: true }
)

export default mongoose.models.Permission || mongoose.model<IPermission>('Permission', PermissionSchema)
