import { NextResponse } from 'next/server'
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import { gzip } from 'zlib'
import { promisify } from 'util'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'

const compress = promisify(gzip)
const backupDirectory = path.join(process.cwd(), 'storage', 'backups')
const safeName = (name: string) => /^stocky-\d{8}T\d{6}-[a-f\d]{8}\.json\.gz$/.test(name)

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'backup')
  await mkdir(backupDirectory, { recursive: true })
  const name = new URL(req.url).searchParams.get('name')
  if (name) {
    if (!safeName(name)) throw new ApiError(400, 'Invalid backup name')
    try {
      const data = await readFile(path.join(backupDirectory, name))
      return new Response(data, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${name}"` } })
    } catch {
      throw new ApiError(404, 'Backup not found')
    }
  }
  const files = (await readdir(backupDirectory)).filter(safeName)
  const data = await Promise.all(files.map(async (file) => { const info = await stat(path.join(backupDirectory, file)); return { name: file, size: info.size, createdAt: info.birthtime } }))
  return NextResponse.json(data.sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf()))
})

export const POST = withErrorHandler(async () => {
  const user = await requireSession()
  await requirePermission(user, 'backup')
  await dbConnect()
  const database = mongoose.connection.db
  if (!database) throw new ApiError(503, 'Database is not connected')
  const collections = await database.listCollections({}, { nameOnly: true }).toArray()
  const payload: Record<string, unknown> = {
    format: 'stocky-mongodb-json-v1',
    createdAt: new Date().toISOString(),
    database: database.databaseName,
    collections: {},
  }
  const output = payload.collections as Record<string, unknown[]>
  for (const { name } of collections) output[name] = await database.collection(name).find({}).toArray()
  const archive = await compress(Buffer.from(JSON.stringify(payload)))
  await mkdir(backupDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '')
  const random = new mongoose.Types.ObjectId().toHexString().slice(-8)
  const name = `stocky-${timestamp}-${random}.json.gz`
  await writeFile(path.join(backupDirectory, name), archive, { flag: 'wx' })
  return NextResponse.json({ name, size: archive.length }, { status: 201 })
})
