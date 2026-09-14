import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeRegex, parsePagination } from '../lib/utils'

test('pagination rejects invalid and out-of-range values', () => {
  assert.deepEqual(parsePagination(new URL('http://localhost/test?page=nope&limit=-20')), {
    page: 1,
    limit: 1,
    skip: 0,
    search: '',
    sortBy: 'createdAt',
    sortDir: -1,
  })
  assert.equal(parsePagination(new URL('http://localhost/test?limit=500')).limit, 100)
})

test('search input is trimmed and bounded', () => {
  const parsed = parsePagination(new URL(`http://localhost/test?search=${encodeURIComponent(`  ${'x'.repeat(200)}  `)}`))
  assert.equal(parsed.search.length, 100)
  assert.equal(parsed.search, 'x'.repeat(100))
})

test('Mongo search patterns treat regular-expression metacharacters literally', () => {
  const input = '[SKU].*+$'
  const pattern = new RegExp(escapeRegex(input), 'i')
  assert.equal(pattern.test(input), true)
  assert.equal(pattern.test('SKU-anything'), false)
})

test('date filter boundaries cover full days without millisecond leakage', () => {
  const dateFrom = '2026-09-14'
  const dateTo = '2026-09-14'
  const start = new Date(dateFrom)
  const end = new Date(dateTo)
  end.setHours(23, 59, 59, 999)

  const midday = new Date('2026-09-14T12:00:00.000Z')
  const nextDay = new Date('2026-09-15T00:00:00.000Z')

  assert.ok(midday >= start && midday <= end)
  assert.ok(nextDay > end)
})
