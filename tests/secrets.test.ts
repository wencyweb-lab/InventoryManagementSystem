import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptSecret, encryptSecret } from '../lib/secrets'

test('application secrets are encrypted with authenticated, randomized ciphertext', () => {
  const previous = process.env.SECRETS_ENCRYPTION_KEY
  process.env.SECRETS_ENCRYPTION_KEY = 'test-only-key-with-at-least-thirty-two-characters'
  try {
    const first = encryptSecret('smtp-password')
    const second = encryptSecret('smtp-password')
    assert.notEqual(first, second)
    assert.equal(decryptSecret(first), 'smtp-password')
    assert.equal(decryptSecret(second), 'smtp-password')
  } finally {
    if (previous === undefined) delete process.env.SECRETS_ENCRYPTION_KEY
    else process.env.SECRETS_ENCRYPTION_KEY = previous
  }
})

test('legacy plaintext secrets remain readable for controlled migration', () => {
  assert.equal(decryptSecret('legacy-value'), 'legacy-value')
})
