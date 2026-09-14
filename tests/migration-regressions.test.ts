import test from 'node:test'
import assert from 'node:assert/strict'
import { generateResetToken, hashResetToken, resetPasswordSchema, resetRequestSchema } from '../lib/password-reset'
import { canonicalCommercialDocument, paymentSchema } from '../lib/validation'
import { CalculationError, round2, round4 } from '../lib/calculations'

test('recovery tokens are unpredictable and stored as non-reversible hashes', () => {
  const first = generateResetToken()
  const second = generateResetToken()
  assert.equal(first.hash, hashResetToken(first.token))
  assert.notEqual(first.hash, first.token)
  assert.notEqual(first.token, second.token)
  assert.equal(first.token.length, 64)
})

test('password recovery rejects query injection and truncated bcrypt passwords', () => {
  assert.equal(resetRequestSchema.parse({ email: ' USER@example.com ' }).email, 'user@example.com')
  assert.throws(() => resetRequestSchema.parse({ email: { $ne: null } }))
  const valid = { email: 'user@example.com', token: 'a'.repeat(64), password: 'password123' }
  assert.doesNotThrow(() => resetPasswordSchema.parse(valid))
  assert.throws(() => resetPasswordSchema.parse({ ...valid, token: { $ne: null } }))
  assert.throws(() => resetPasswordSchema.parse({ ...valid, password: '1234567' }))
  assert.throws(() => resetPasswordSchema.parse({ ...valid, password: '界'.repeat(25) }))
})

test('payments cannot silently round down to zero', () => {
  assert.throws(() => paymentSchema.parse({ date: '2026-09-14', montant: 0.001 }))
  assert.equal(paymentSchema.parse({ date: '2026-09-14', montant: 0.01 }).montant, 0.01)
})

test('overflow and excessive discounts are domain validation errors', () => {
  assert.throws(() => round2(Infinity), CalculationError)
  assert.throws(() => round4(Number.MAX_VALUE), CalculationError)
  assert.throws(() => canonicalCommercialDocument({ date: '2026-09-14', warehouse_id: 'a'.repeat(24), status: 'pending',
    details: [{ product_id: 'b'.repeat(24), quantity: 1, unit_price: 10, discount: 200 }],
  }), CalculationError)
})
