import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requireSession, requirePermission, withErrorHandler } from '@/lib/permissions'
import User from '@/models/User'
import Role from '@/models/Role'
import bcrypt from 'bcryptjs'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { userCreateSchema } from '@/lib/validation'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'users_view')
  await dbConnect()
  const { page, limit, skip, search } = parsePagination(new URL(req.url))
  const filter: any = { deletedAt: null }
  if (search) { const pattern = escapeRegex(search); filter.$or = [{ name: { $regex: pattern, $options: 'i' } }, { email: { $regex: pattern, $options: 'i' } }] }
  const [data, total] = await Promise.all([
    User.find(filter).select('-password').populate('roles', 'name statut').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ])
  return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'users_add')
  await dbConnect()
  const body = userCreateSchema.parse(await req.json())
  const existing = await User.findOne({ email: body.email.toLowerCase(), deletedAt: null })
  if (existing) throw new ApiError(409, 'Email is already registered')
  const roleCount = await Role.countDocuments({ _id: { $in: body.roles }, statut: true, deletedAt: null })
  if (roleCount !== new Set(body.roles).size) throw new ApiError(422, 'One or more roles are invalid')
  const password = await bcrypt.hash(body.password, 12)
  const created = await User.create({ ...body, email: body.email.toLowerCase(), password })
  const result = created.toObject() as any
  delete result.password
  return NextResponse.json(result, { status: 201 })
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'users_delete')
  await dbConnect()
  const ids = await parseBulkIds(req)
  // Self-deletion guard: cannot delete current logged-in user
  const sanitizedIds = ids.filter((id) => String(id) !== String(user.id))
  if (!sanitizedIds.length) throw new ApiError(400, 'Cannot delete your own user account')
  await User.updateMany({ _id: { $in: sanitizedIds }, deletedAt: null }, { $set: { deletedAt: new Date(), statut: false } })
  return NextResponse.json({ message: `${sanitizedIds.length} users deleted`, count: sanitizedIds.length })
})

