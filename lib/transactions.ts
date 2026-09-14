import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { ApiError } from '@/lib/permissions'

export async function startTransactionSession() {
  await dbConnect()
  const database = mongoose.connection.db
  if (!database) throw new ApiError(503, 'MongoDB is not connected')
  const hello = await database.admin().command({ hello: 1 })
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new ApiError(503, 'Writes require a MongoDB replica set. Configure the replica set before changing inventory or payments.')
  }
  const session = await mongoose.startSession()
  session.startTransaction()
  return session
}
