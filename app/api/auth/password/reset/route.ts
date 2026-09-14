import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import User from '@/models/User'
import PasswordReset from '@/models/PasswordReset'
import { ApiError, withErrorHandler } from '@/lib/permissions'
import { startTransactionSession } from '@/lib/transactions'
import { hashResetToken, RESET_LIFETIME_MS, resetPasswordSchema } from '@/lib/password-reset'

export const POST = withErrorHandler(async (req: Request) => {
  const { email, token, password } = resetPasswordSchema.parse(await req.json())
  const passwordHash = await bcrypt.hash(password, 12)
  const session = await startTransactionSession()
  try {
    // TTL cleanup is asynchronous; enforce expiry in the consuming query too.
    const reset = await PasswordReset.findOneAndDelete({ email, token: hashResetToken(token),
      createdAt: { $gt: new Date(Date.now() - RESET_LIFETIME_MS) },
    }, { session })
    if (!reset) throw new ApiError(400, 'This password reset link is invalid or has expired.')
    const result = await User.updateOne({ email, deletedAt: null, statut: true }, {
      $set: { password: passwordHash }, $inc: { sessionVersion: 1 },
    }, { session })
    if (!result.matchedCount) throw new ApiError(400, 'This password reset link is invalid or has expired.')
    await PasswordReset.deleteMany({ email }, { session })
    await session.commitTransaction()
    return NextResponse.json({ success: true, message: 'Your password has been changed. Please sign in.' })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})
