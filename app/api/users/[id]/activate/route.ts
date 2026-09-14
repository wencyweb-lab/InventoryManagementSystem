import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import User from '@/models/User'

type Ctx = { params: { id: string } }

/**
 * PATCH /api/users/[id]/activate
 * Quick-toggle the user active/inactive status (statut field) without
 * requiring the full user body. Mirrors the legacy PUT /api/users/Activated/{id}.
 */
export const PATCH = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const actor = await requireSession()
  await requirePermission(actor, 'users_edit')
  await dbConnect()

  const body = await req.json()
  const statut = Boolean(body.statut)

  if (actor.id === ctx.params.id && !statut) {
    throw new ApiError(409, 'You cannot deactivate your own account')
  }

  const user = await User.findOneAndUpdate(
    { _id: ctx.params.id, deletedAt: null },
    { $set: { statut } },
    { new: true }
  ).select('-password')

  if (!user) throw new ApiError(404, 'User not found')

  // If deactivating, bump sessionVersion so existing tokens are invalidated immediately.
  if (!statut) {
    await User.updateOne({ _id: ctx.params.id }, { $inc: { sessionVersion: 1 } })
  }

  return NextResponse.json({ message: `User ${statut ? 'activated' : 'deactivated'}`, user })
})
