import mongoose, { Schema } from 'mongoose'

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 1110 },
  },
  { timestamps: true }
)

export default mongoose.models.Counter || mongoose.model('Counter', CounterSchema)
