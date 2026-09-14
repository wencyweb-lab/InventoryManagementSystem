import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { userUpdateSchema } from '@/lib/validation'
import User from '@/models/User'
import Role from '@/models/Role'
import bcrypt from 'bcryptjs'

type Ctx = { params: { id: string } }

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const user = await requireSession()
  await requirePermission(user, 'users_view')
  await dbConnect()
  const document = await User.findOne({ _id: ctx.params.id, deletedAt: null }).select('-password').populate('roles', 'name statut')
  if (!document) throw new ApiError(404, 'User not found')
  return NextResponse.json(document)
})

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const actor = await requireSession()
  await requirePermission(actor, 'users_edit')
  await dbConnect()
  const body = userUpdateSchema.parse(await req.json())
  if (body.email) {
    const existing = await User.findOne({ email: body.email.toLowerCase(), _id: { $ne: ctx.params.id }, deletedAt: null })
    if (existing) throw new ApiError(409, 'Email is already registered')
  }
  if (actor.id === ctx.params.id && !body.statut) throw new ApiError(409, 'You cannot deactivate your own account')
  const roleCount = await Role.countDocuments({ _id: { $in: body.roles }, statut: true, deletedAt: null })
  if (roleCount !== new Set(body.roles).size) throw new ApiError(422, 'One or more roles are invalid')
  const update: Record<string, unknown> = { ...body, ...(body.email ? { email: body.email.toLowerCase() } : {}) }
  if (body.password) update.password = await bcrypt.hash(body.password, 12)
  else delete update.password
  const document = await User.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, { $set: update, ...(body.password ? { $inc: { sessionVersion: 1 } } : {}) }, { new: true, runValidators: true }).select('-password')
  if (!document) throw new ApiError(404, 'User not found')
  return NextResponse.json(document)
})

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const actor = await requireSession()
  await requirePermission(actor, 'users_delete')
  if (actor.id === ctx.params.id) throw new ApiError(409, 'You cannot delete your own account')
  await dbConnect()
  const document = await User.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, { deletedAt: new Date(), statut: false }, { new: true })
  if (!document) throw new ApiError(404, 'User not found')
  return NextResponse.json({ message: 'User deleted' })
})
