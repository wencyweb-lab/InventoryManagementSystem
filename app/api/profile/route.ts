import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import dbConnect from '@/lib/db'
import { ApiError, requireSession, withErrorHandler } from '@/lib/permissions'
import { profileSchema } from '@/lib/validation'
import User from '@/models/User'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async () => {
  const session = await requireSession()
  const user = await User.findById(session.id).select('-password').populate('roles', 'name')
  return NextResponse.json(user)
})

export const PUT = withErrorHandler(async (req: Request) => {
  const session = await requireSession()
  await dbConnect()
  const body = profileSchema.parse(await req.json())
  const user = await User.findOne({ _id: session.id, statut: true, deletedAt: null })
  if (!user) throw new ApiError(404, 'User not found')
  if (body.password) {
    if (!body.current_password || !await bcrypt.compare(body.current_password, user.password)) {
      throw new ApiError(422, 'Current password is incorrect')
    }
    user.password = await bcrypt.hash(body.password, 12)
    user.sessionVersion = (user.sessionVersion ?? 0) + 1
  }
  user.name = body.name
  user.email = body.email
  user.phone = body.phone
  user.avatar = body.avatar
  await user.save()
  return NextResponse.json({ id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar })
})
