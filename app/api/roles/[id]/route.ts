import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { roleSchema } from '@/lib/validation'
import Role from '@/models/Role'
import Permission from '@/models/Permission'
import User from '@/models/User'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'permissions_view')
  await dbConnect()
  const role = await Role.findOne({ _id: ctx.params.id, deletedAt: null }).populate('permissions', 'name')
  if (!role) throw new ApiError(404, 'Role not found')
  return NextResponse.json(role)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'permissions_edit')
  await dbConnect()
  const body = roleSchema.parse(await req.json())
  const permissionCount = await Permission.countDocuments({ _id: { $in: body.permissions } })
  if (permissionCount !== new Set(body.permissions).size) throw new ApiError(422, 'One or more permissions are invalid')
  const role = await Role.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, body, { new: true, runValidators: true })
  if (!role) throw new ApiError(404, 'Role not found')
  return NextResponse.json(role)
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'permissions_delete')
  await dbConnect()
  const role = await Role.findOne({ _id: ctx.params.id, deletedAt: null })
  if (!role) throw new ApiError(404, 'Role not found')
  if (role.name === 'Owner') throw new ApiError(409, 'The Owner role cannot be deleted')
  if (await User.exists({ roles: role._id, deletedAt: null })) throw new ApiError(409, 'A role assigned to active users cannot be deleted')
  role.deletedAt = new Date()
  role.statut = false
  await role.save()
  return NextResponse.json({ message: 'Role deleted' })
})
