import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import PasswordReset from '@/models/PasswordReset'
import { sendEmail } from '@/lib/email'
import { ApiError, withErrorHandler } from '@/lib/permissions'
import { generateResetToken, resetRequestSchema } from '@/lib/password-reset'

export const POST = withErrorHandler(async (req: Request) => {
  const { email } = resetRequestSchema.parse(await req.json())
  const origin = process.env.NEXTAUTH_URL
  if (!origin) throw new ApiError(503, 'Password recovery is not configured')
  const resetUrl = new URL('/reset-password', origin)
  await dbConnect()
  const response = () => NextResponse.json({ success: true, message: 'If an active account exists, password reset instructions will be emailed.' })
  const user = await User.findOne({ email, deletedAt: null, statut: true })
  if (!user) return response()
  const { token, hash } = generateResetToken()
  const now = new Date()
  // Atomic cooldown shared by every application instance.
  const claimed = await User.updateOne({ _id: user._id, $or: [
    { resetRequestedAt: null }, { resetRequestedAt: { $lte: new Date(now.getTime() - 60_000) } },
  ] }, { $set: { resetRequestedAt: now } })
  if (!claimed.modifiedCount) return response()
  await PasswordReset.deleteMany({ email })
  await PasswordReset.create({ email, token: hash, createdAt: now })
  resetUrl.searchParams.set('token', token)
  resetUrl.searchParams.set('email', email)
  const link = resetUrl.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const sent = await sendEmail({ to: email, subject: 'Reset Password - Stocky ERP',
    text: `Reset your password using ${resetUrl}. This link expires in 60 minutes. Ignore this email if you did not request it.`,
    html: `<p>A password reset was requested for your account.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 60 minutes. Ignore this email if you did not request it.</p>`,
  })
  if (!sent) await PasswordReset.deleteOne({ email, token: hash })
  return response()
})
