import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requireSession, requirePermission, withErrorHandler } from '@/lib/permissions'
import Role from '@/models/Role'
import User from '@/models/User'
import Permission from '@/models/Permission'
import { roleSchema } from '@/lib/validation'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await dbConnect()
  const url = new URL(req.url)
  if (url.searchParams.get('all') === 'true' || url.searchParams.get('unpaginated') === 'true') {
    return NextResponse.json(await Role.find({ deletedAt: null, statut: true }).select('name').sort({ name: 1 }).lean())
  }
  await requirePermission(user, 'permissions_view')
  const [roles, permissions] = await Promise.all([
    Role.find({ deletedAt: null }).populate('permissions', 'name').sort({ createdAt: -1 }).lean(),
    Permission.find().sort({ name: 1 }).lean(),
  ])
  return NextResponse.json({ roles, permissions })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'permissions_add')
  await dbConnect()
  const body = roleSchema.parse(await req.json())
  const permissionCount = await Permission.countDocuments({ _id: { $in: body.permissions } })
  if (permissionCount !== new Set(body.permissions).size) throw new ApiError(422, 'One or more permissions are invalid')
  return NextResponse.json(await Role.create(body), { status: 201 })
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'permissions_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)
  const hasOwner = await Role.exists({ name: 'Owner', _id: { $in: ids } })
  if (hasOwner) throw new ApiError(409, 'The Owner role cannot be deleted')
  if (await User.exists({ roles: { $in: ids }, deletedAt: null })) {
    throw new ApiError(409, 'Roles assigned to active users cannot be deleted')
  }
  await Role.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date(), statut: false } })
  return NextResponse.json({ message: `${ids.length} roles deleted`, count: ids.length })
})
