import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IRole extends Document {
  name: string
  statut: boolean
  permissions: Types.ObjectId[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    statut: { type: Boolean, default: true },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

RoleSchema.index({ deletedAt: 1 })
RoleSchema.index({ name: 1, deletedAt: 1 }, { unique: true })

export default mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema)
