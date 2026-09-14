/** Run after npm run build. Uses only a fresh database on the audit replica set. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { generateResetToken } from '../lib/password-reset'

const databaseName = `migration_audit_${Date.now()}`
const uri = `mongodb://127.0.0.1:27119/${databaseName}?replicaSet=migrationAudit&directConnection=true`
const origin = 'http://localhost:3119'
const password = randomBytes(24).toString('hex')
const email = 'audit@example.test'
let child: ReturnType<typeof spawn> | undefined
let assertions = 0
const log = createWriteStream('storage/migration-http.log')
const cookies = new Map<string, string>()

async function request(path: string, method = 'GET', body?: unknown, expected = 200, authenticated = true) {
  const response = await fetch(`${origin}${path}`, { method, redirect: 'manual', headers: {
    ...(authenticated ? { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  }, body: body === undefined ? undefined : JSON.stringify(body) })
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]; const split = pair.indexOf('=')
    cookies.set(pair.slice(0, split), pair.slice(split + 1))
  }
  const content = await response.text()
  assert.equal(response.status, expected, `${method} ${path}: ${content.slice(0, 250)}`)
  assertions++
  return response.headers.get('content-type')?.includes('application/json') ? JSON.parse(content) : content
}

async function main() {
  await mongoose.connect(uri)
  const db = mongoose.connection.db!
  assert.equal(await db.collection('users').countDocuments(), 0, 'Audit database must be new')
  const seedSource = await readFile('scripts/seed.ts', 'utf8')
  const permissionNames = [...seedSource.split('const permissionNames = [')[1].split(']')[0].matchAll(/'([^']+)'/g)].map(match => match[1])
  const permissions = permissionNames.map(name => ({ _id: new mongoose.Types.ObjectId(), name }))
  await db.collection('permissions').insertMany(permissions)
  const roleId = new mongoose.Types.ObjectId()
  const userId = new mongoose.Types.ObjectId()
  await db.collection('roles').insertOne({ _id: roleId, name: 'Audit Owner', permissions: permissions.map(p => p._id), statut: true, deletedAt: null })
  await db.collection('users').insertOne({ _id: userId, email, name: 'Audit Owner', password: await bcrypt.hash(password, 12), roles: [roleId], statut: true, deletedAt: null, sessionVersion: 0 })
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3119'], {
    windowsHide: true, env: { ...process.env, MONGODB_URI: uri, NEXTAUTH_URL: origin, NEXTAUTH_SECRET: randomBytes(32).toString('hex') },
  })
  child.stdout?.pipe(log); child.stderr?.pipe(log)
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Audit web server exited; inspect storage/migration-http.log')
    try { const response = await fetch(`${origin}/api/auth/csrf`); if (response.ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Audit server did not start')
  await request('/api/sales', 'GET', undefined, 401, false)
  const csrf = await request('/api/auth/csrf')
  const login = await fetch(`${origin}/api/auth/callback/credentials`, { method: 'POST', redirect: 'manual', headers: {
    'content-type': 'application/x-www-form-urlencoded', cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
  }, body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: `${origin}/dashboard`, json: 'true' }) })
  for (const cookie of login.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const split = pair.indexOf('='); cookies.set(pair.slice(0, split), pair.slice(split + 1)) }
  const session = await request('/api/auth/session')
  assert.equal(session.user.email, email)
  const upload = new FormData()
  upload.append('files', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'audit.png')
  const uploaded = await fetch(`${origin}/api/uploads/products`, { method: 'POST', headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, body: upload })
  assert.equal(uploaded.status, 201)
  const image = await uploaded.json()
  const imageResponse = await fetch(`${origin}/uploads/products/${image.files[0]}`)
  assert.equal(imageResponse.status, 200, 'Uploaded images must be immediately available without a server restart')
  assert.equal(imageResponse.headers.get('content-type'), 'image/png')
  const unit = await request('/api/units', 'POST', { name: 'Each', short_name: 'ea', base_unit: null }, 201)
  const warehouse = await request('/api/warehouses', 'POST', { name: 'Audit A' }, 201)
  const other = await request('/api/warehouses', 'POST', { name: 'Audit B' }, 201)
  const customer = await request('/api/clients', 'POST', { name: 'Audit Customer', email: 'customer@example.test' }, 201)
  const supplier = await request('/api/providers', 'POST', { name: 'Audit Supplier' }, 201)
  const product = await request('/api/products', 'POST', { name: 'Audit Product', code: 'AUDIT-1', cost: 5, price: 10, unit_id: unit._id, sale_unit_id: unit._id, purchase_unit_id: unit._id, category_id: null, brand_id: null }, 201)
  const document = { date: '2026-09-14', warehouse_id: warehouse._id, details: [{ product_id: product._id, unit_id: unit._id, variant_id: null, quantity: 10, unit_price: 10 }], status: 'received' }
  const stock = async (warehouseId = warehouse._id) => (await db.collection('productwarehouses').findOne({ product_id: new mongoose.Types.ObjectId(product._id), warehouse_id: new mongoose.Types.ObjectId(warehouseId), deletedAt: null }))?.qte
  const purchase = await request('/api/purchases', 'POST', { ...document, provider_id: supplier._id }, 201)
  assert.equal(await stock(), 10)
  await request(`/api/products/${product._id}`)
  await request(`/api/purchases/${purchase._id}`)
  await request('/api/products', 'DELETE', { ids: [product._id] }, 409)
  assert.equal(await stock(), 10)
  await request('/api/sales', 'POST', { ...document, client_id: 'a'.repeat(24), status: 'pending' }, 422)
  const saleBody = { ...document, client_id: customer._id, status: 'completed', details: [{ ...document.details[0], quantity: 3 }] }
  const sale = await request('/api/sales', 'POST', saleBody, 201)
  assert.equal(await stock(), 7)
  await request(`/api/purchases/${purchase._id}`, 'PUT', { ...document, provider_id: supplier._id, notes: 'Notes changed after partial stock consumption' })
  assert.equal(await stock(), 7)
  await request('/api/warehouses', 'DELETE', { ids: [warehouse._id] }, 409)
  await request('/api/products', 'DELETE', { ids: [{ $ne: null }] }, 422)
  await request(`/api/units/${unit._id}`, 'DELETE', undefined, 409)
  await request('/api/sales', 'POST', { ...saleBody, details: [{ ...document.details[0], quantity: 100 }] }, 409)
  assert.equal(await stock(), 7)
  assert.equal(await db.collection('sales').countDocuments({ deletedAt: null }), 1)
  const payment = await request('/api/payment/sale', 'POST', { parent_id: sale._id, date: document.date, montant: 10 }, 201)
  await request(`/api/payment/sale/${payment._id}`)
  await request(`/dashboard/payments/sale/${payment._id}`)
  await request(`/api/payment/sale/${payment._id}`, 'PUT', { date: document.date, montant: 20 })
  await request('/api/payment/sale', 'POST', { parent_id: sale._id, date: document.date, montant: 20 }, 409)
  await request(`/api/sales/${sale._id}`, 'PUT', { ...saleBody, details: [{ ...document.details[0], quantity: 1 }] }, 409)
  assert.equal(await stock(), 7)
  const report = await request(`/api/reports?type=customer_detail&id=${customer._id}&from=2026-01-01&to=2026-12-31`)
  assert.equal(report.payments.length, 1)
  await request(`/api/sales/${sale._id}`, 'DELETE')
  assert.equal(await stock(), 10)
  assert.equal(await db.collection('paymentsales').countDocuments({ deletedAt: null }), 0)
  const transfer = await request('/api/transfers', 'POST', { date: document.date, from_warehouse_id: warehouse._id, to_warehouse_id: other._id, status: 'sent', details: [{ ...document.details[0], quantity: 2, Net_price: 5 }] }, 201)
  assert.equal(await stock(), 8); assert.equal(await stock(other._id), 0)
  await request(`/api/transfers/${transfer._id}`, 'PUT', { date: document.date, from_warehouse_id: warehouse._id, to_warehouse_id: other._id, status: 'completed', details: [{ ...document.details[0], quantity: 2, Net_price: 5 }] })
  assert.equal(await stock(), 8); assert.equal(await stock(other._id), 2)
  await request(`/api/transfers/${transfer._id}`, 'DELETE')
  assert.equal(await stock(), 10); assert.equal(await stock(other._id), 0)
  const adjustment = await request('/api/adjustments', 'POST', { date: document.date, warehouse_id: warehouse._id, details: [{ product_id: product._id, quantity: 2, type: 'add', cost: 5 }] }, 201)
  assert.equal(await stock(), 12)
  await request(`/api/adjustments/${adjustment._id}`, 'PUT', { date: document.date, warehouse_id: warehouse._id, details: [{ product_id: product._id, quantity: 1, type: 'sub', cost: 5 }] })
  assert.equal(await stock(), 9)
  await request(`/api/adjustments/${adjustment._id}`, 'DELETE')
  assert.equal(await stock(), 10)
  for (const kind of ['sale', 'purchase']) {
    const returnBody = { ...document, client_id: kind === 'sale' ? customer._id : undefined, provider_id: kind === 'purchase' ? supplier._id : undefined, status: kind === 'sale' ? 'received' : 'completed', details: [{ ...document.details[0], quantity: 2 }] }
    const ret = await request(`/api/returns/${kind}`, 'POST', returnBody, 201)
    assert.equal(await stock(), kind === 'sale' ? 12 : 8)
    const payment = await request(`/api/payment/${kind}-return`, 'POST', { parent_id: ret._id, date: document.date, montant: 5 }, 201)
    await request(`/api/payment/${kind}-return/${payment._id}`)
    await request(`/api/returns/${kind}/${ret._id}`, 'PUT', { ...returnBody, notes: 'Updated return' })
    await request(`/api/returns/${kind}`, 'DELETE', { ids: [ret._id] })
    assert.equal(await stock(), 10)
    assert.equal(await db.collection(kind === 'sale' ? 'paymentsalereturns' : 'paymentpurchasereturns').countDocuments({ deletedAt: null }), 0)
  }
  const quote = await request('/api/quotations', 'POST', { ...saleBody, status: 'pending' }, 201)
  const converted = await request(`/api/quotations/${quote._id}/convert`)
  assert.ok(converted)
  assert.equal(await stock(), 10)
  const pos = await request('/api/pos', 'POST', { ...saleBody, details: [{ ...document.details[0], quantity: 1 }], tendered: 15 }, 201)
  assert.equal(pos.payment.change, 5); assert.equal(await stock(), 9)
  await request(`/api/sales/${pos.sale._id}`, 'DELETE')
  assert.equal(await stock(), 10)
  const contenders = await Promise.all([1, 2].map(() => fetch(`${origin}/api/sales`, { method: 'POST', headers: {
    'content-type': 'application/json', cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
  }, body: JSON.stringify({ ...saleBody, details: [{ ...document.details[0], quantity: 8 }] }) })))
  assert.deepEqual(contenders.map(response => response.status).sort(), [201, 409], 'Concurrent sales must not oversell')
  const winner = await contenders.find(response => response.status === 201)!.json()
  assert.equal(await stock(), 2)
  await request(`/api/sales/${winner._id}`, 'DELETE')
  assert.equal(await stock(), 10)
  await db.collection('roles').updateOne({ _id: roleId }, { $set: { permissions: permissions.filter(p => p.name !== 'Sales_view').map(p => p._id) } })
  await request('/api/sales', 'GET', undefined, 403)
  await db.collection('roles').updateOne({ _id: roleId }, { $set: { permissions: permissions.filter(p => p.name !== 'record_view').map(p => p._id) } })
  const foreignId = new mongoose.Types.ObjectId()
  await db.collection('sales').insertOne({ _id: foreignId, Ref: 'FOREIGN', date: new Date(document.date), user_id: new mongoose.Types.ObjectId(), client_id: new mongoose.Types.ObjectId(customer._id), GrandTotal: 100, deletedAt: null })
  await request(`/api/sales/${foreignId}`, 'GET', undefined, 404)
  const own = await request('/api/sales')
  assert.ok(own.data.every((row: any) => row._id !== String(foreignId)))
  await db.collection('roles').updateOne({ _id: roleId }, { $set: { permissions: permissions.map(p => p._id) } })
  await request(`/api/reports?type=warehouse_detail&id=${warehouse._id}`)
  await request('/api/reports?type=sales&from=invalid', 'GET', undefined, 422)
  await request('/api/seed', 'POST', {}, 410)
  await request('/dashboard/reports/warehouse/' + warehouse._id)
  const known = await request('/api/auth/password/create', 'POST', { email }, 200, false)
  const unknown = await request('/api/auth/password/create', 'POST', { email: 'unknown@example.test' }, 200, false)
  assert.deepEqual(known, unknown)
  assert.equal(known.reset_url, undefined)
  await request('/api/auth/password/reset', 'POST', { email, token: { $ne: null }, password }, 422, false)
  const expired = generateResetToken()
  await db.collection('passwordresets').insertOne({ email, token: expired.hash, createdAt: new Date(Date.now() - 3_600_001) })
  await request('/api/auth/password/reset', 'POST', { email, token: expired.token, password }, 400, false)
  const valid = generateResetToken()
  await db.collection('passwordresets').insertOne({ email, token: valid.hash, createdAt: new Date() })
  await request('/api/auth/password/reset', 'POST', { email, token: valid.token, password }, 200, false)
  await request('/api/auth/password/reset', 'POST', { email, token: valid.token, password }, 400, false)
  await request('/api/sales', 'GET', undefined, 401)
  console.log(`PASS: ${assertions} HTTP checks plus stock, rollback, payment, report and recovery assertions. Database: ${databaseName}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  child?.kill()
  await mongoose.disconnect()
  log.end()
})
