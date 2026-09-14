/**
 * Database Seed Script
 * Run: npx tsx scripts/seed.ts
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI!

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to MongoDB')

  // --- Import models ---
  const Permission = (await import('../models/Permission')).default
  const Role = (await import('../models/Role')).default
  const User = (await import('../models/User')).default
  const Currency = (await import('../models/Currency')).default
  const Client = (await import('../models/Client')).default
  const Warehouse = (await import('../models/Warehouse')).default
  const { Setting, PosSetting } = await import('../models/Settings')

  // --- Permissions (88 named abilities, matches legacy seeder) ---
  const permissionNames = [
    'users_view', 'users_edit', 'record_view', 'users_delete', 'users_add',
    'permissions_edit', 'permissions_view', 'permissions_delete', 'permissions_add',
    'products_delete', 'products_view', 'barcode_view', 'products_edit', 'products_add',
    'expense_add', 'expense_delete', 'expense_edit', 'expense_view',
    'transfer_delete', 'transfer_add', 'transfer_view', 'transfer_edit',
    'adjustment_delete', 'adjustment_add', 'adjustment_edit', 'adjustment_view',
    'Sales_edit', 'Sales_view', 'Sales_delete', 'Sales_add',
    'Purchases_edit', 'Purchases_view', 'Purchases_delete', 'Purchases_add',
    'Quotations_edit', 'Quotations_delete', 'Quotations_add', 'Quotations_view',
    'payment_sales_delete', 'payment_sales_add', 'payment_sales_edit', 'payment_sales_view',
    'Purchase_Returns_delete', 'Purchase_Returns_add', 'Purchase_Returns_view', 'Purchase_Returns_edit',
    'Sale_Returns_delete', 'Sale_Returns_add', 'Sale_Returns_edit', 'Sale_Returns_view',
    'payment_purchases_edit', 'payment_purchases_view', 'payment_purchases_delete', 'payment_purchases_add',
    'payment_returns_edit', 'payment_returns_view', 'payment_returns_delete', 'payment_returns_add',
    'Customers_edit', 'Customers_view', 'Customers_delete', 'Customers_add',
    'unit', 'currency', 'category', 'backup', 'warehouse', 'brand', 'setting_system',
    'Warehouse_report', 'Reports_quantity_alerts', 'Reports_profit',
    'Reports_suppliers', 'Reports_customers', 'Reports_purchase', 'Reports_sales',
    'Reports_payments_purchase_Return', 'Reports_payments_Sale_Returns',
    'Reports_payments_Purchases', 'Reports_payments_Sales',
    'Suppliers_delete', 'Suppliers_add', 'Suppliers_edit', 'Suppliers_view',
    'Pos_view', 'product_import', 'customers_import', 'Suppliers_import',
  ]

  console.log('🔑 Seeding permissions...')
  await Permission.deleteMany({})
  const permissions = await Permission.insertMany(permissionNames.map(name => ({ name })))
  const permMap = Object.fromEntries(permissions.map((p: any) => [p.name, p._id]))
  console.log(`   ${permissions.length} permissions created`)

  // --- Owner role with all permissions ---
  console.log('👑 Seeding Owner role...')
  await Role.deleteMany({})
  const ownerRole = await Role.create({
    name: 'Owner',
    statut: true,
    permissions: permissions.map((p: any) => p._id),
  })
  console.log(`   Role "${ownerRole.name}" created with all ${permissions.length} permissions`)

  // --- Admin user ---
  console.log('👤 Seeding admin user...')
  await User.deleteMany({})
  const hashedPassword = await bcrypt.hash('password', 12)
  const adminUser = await User.create({
    name: 'Administrator',
    email: 'admin@example.com',
    password: hashedPassword,
    phone: '',
    avatar: 'avatar-default.png',
    statut: true,
    roles: [ownerRole._id],
  })
  console.log(`   User "${adminUser.email}" created`)

  // --- Default currency ---
  console.log('💰 Seeding default currency...')
  await Currency.deleteMany({})
  const currency = await Currency.create({ name: 'US Dollar', code: 'USD', symbol: '$' })

  // --- Default warehouse ---
  console.log('🏭 Seeding default warehouse...')
  await Warehouse.deleteMany({})
  const warehouse = await Warehouse.create({ name: 'Main Warehouse', city: '', country: '', email: '', phone: '', zip: '' })

  // --- Default client ---
  console.log('👥 Seeding default client...')
  await Client.deleteMany({})
  const client = await Client.create({ name: 'Walk-in Customer', code: '000001', email: '', phone: '', country: '', city: '', address: '', tax_number: '' })

  // --- Settings ---
  console.log('⚙️  Seeding settings...')
  await Setting.deleteMany({})
  await Setting.create({
    CompanyName: 'Stocky',
    CompanyPhone: '',
    CompanyAdress: '',
    email: 'admin@example.com',
    logo: 'logo-default.png',
    footer: 'Stocky - Ultimate Inventory with POS',
    developed_by: 'Stocky',
    currency_id: currency._id,
    client_id: client._id,
    warehouse_id: warehouse._id,
    default_language: 'en',
  })

  // --- POS settings ---
  await PosSetting.deleteMany({})
  await PosSetting.create({
    note_customer: 'Thank You For Shopping With Us. Please Come Again.',
    show_note: true,
    show_barcode: true,
    show_discount: true,
    show_customer: true,
    show_email: true,
    show_phone: true,
    show_address: true,
  })

  console.log('\n✅ Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔐 Login: admin@example.com')
  console.log('🔑 Password: password')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
