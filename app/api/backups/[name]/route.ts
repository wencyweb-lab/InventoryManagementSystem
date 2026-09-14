import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'

const backupDirectory = path.join(process.cwd(), 'storage', 'backups')
const safeName = (name: string) => /^stocky-\d{8}T\d{6}-[a-f\d]{8}\.json\.gz$/.test(name)

export const DELETE = withErrorHandler(async (_req: Request, ctx: { params: { name: string } }) => {
  const user = await requireSession()
  await requirePermission(user, 'backup')
  const name = decodeURIComponent(ctx.params.name)
  if (!safeName(name)) throw new ApiError(400, 'Invalid backup name')
  try {
    await unlink(path.join(backupDirectory, name))
  } catch {
    throw new ApiError(404, 'Backup not found')
  }
  return NextResponse.json({ message: 'Backup deleted' })
})
