import mongoose from 'mongoose'

// Ensure all Mongoose schemas and models are registered before any queries or population
import '@/models/Adjustment'
import '@/models/Brand'
import '@/models/Category'
import '@/models/Client'
import '@/models/CommunicationLog'
import '@/models/Counter'
import '@/models/Currency'
import '@/models/Expense'
import '@/models/PasswordReset'
import '@/models/Payments'
import '@/models/Permission'
import '@/models/Product'
import '@/models/ProductWarehouse'
import '@/models/Provider'
import '@/models/Purchase'
import '@/models/Quotation'
import '@/models/Returns'
import '@/models/Role'
import '@/models/Sale'
import '@/models/Settings'
import '@/models/Transfer'
import '@/models/Unit'
import '@/models/User'
import '@/models/Warehouse'

const MONGODB_URI = process.env.MONGODB_URI as string

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local')
}

declare global {
  var mongoose: { conn: typeof import('mongoose') | null; promise: Promise<typeof import('mongoose')> | null }
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function dbConnect() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    const opts = { bufferCommands: false }
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => mongoose)
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default dbConnect
