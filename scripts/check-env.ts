import mongoose from 'mongoose'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured')
  if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not configured')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 })
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error('MongoDB must be configured as a replica set; standalone writes are disabled')
  } else {
    console.log('✅ Environment check passed: MongoDB is reachable and transaction-capable.')
  }
}

main().catch((error) => {
  console.error(`Environment check failed: ${error.message}`)
  process.exitCode = 1
}).finally(async () => {
  await mongoose.disconnect()
})

