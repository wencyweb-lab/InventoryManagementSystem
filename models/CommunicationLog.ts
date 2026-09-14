import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ICommunicationLog extends Document {
  idempotency_key: string
  channel: 'email' | 'sms'
  resource: string
  document_id: Types.ObjectId
  user_id: Types.ObjectId
  recipient_masked: string
  status: 'pending' | 'sent' | 'failed'
  provider_id: string
  error: string
  createdAt: Date
  updatedAt: Date
}

const CommunicationLogSchema = new Schema<ICommunicationLog>(
  {
    idempotency_key: { type: String, required: true, unique: true },
    channel: { type: String, enum: ['email', 'sms'], required: true },
    resource: { type: String, required: true },
    document_id: { type: Schema.Types.ObjectId, required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient_masked: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    provider_id: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
)

export default mongoose.models.CommunicationLog || mongoose.model('CommunicationLog', CommunicationLogSchema)
