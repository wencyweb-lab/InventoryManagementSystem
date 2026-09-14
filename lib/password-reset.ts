import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'

export const RESET_LIFETIME_MS = 60 * 60 * 1000
export const resetRequestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) })
export const resetPasswordSchema = resetRequestSchema.extend({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).max(200).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes'),
})
export function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
export function generateResetToken() {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashResetToken(token) }
}
