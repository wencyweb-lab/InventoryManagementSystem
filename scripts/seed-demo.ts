import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import {
  calcGrandTotal,
  calcLine,
  calcPaymentStatus,
  round2,
  toBaseQty,
  type DiscountMethod,
  type TaxMethod,
} from '../lib/calculations'

dotenv.config({ path: '.env.local' })

const apply = process.argv.includes('--apply')
const DEMO_PASSWORD = 'Demo123!'

type UnitDoc = {
  _id: mongoose.Types.ObjectId
  operator: '*' | '/'
  operator_value: number
}

type ProductDoc = {
  _id: mongoose.Types.ObjectId
  code: string
  name: string
  cost: number
  price: number
  tax_method: TaxMethod
  TaxNet: number
  unit_id: mongoose.Types.ObjectId
  variants: Array<{ _id: mongoose.Types.ObjectId; name: string; code: string }>
}

type LineInput = {
  product: ProductDoc
  quantity: number
  unit: UnitDoc
  unitPrice: number
  variantId?: mongoose.Types.ObjectId | null
  discount?: number
  discountMethod?: DiscountMethod
  taxRate?: number
  taxMethod?: TaxMethod
}

type CommercialLine = ReturnType<typeof commercialLine>

function daysAgo(days: number, hour = 10) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function commercialLine(input: LineInput) {
  const discount = input.discount ?? 0
  const discountMethod = input.discountMethod ?? '1'
  const taxRate = input.taxRate ?? input.product.TaxNet
  const taxMethod = input.taxMethod ?? input.product.tax_method
  const calculated = calcLine({
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    discount,
    discountMethod,
    taxRate,
    taxMethod,
  })

  return {
    product_id: input.product._id,
    variant_id: input.variantId ?? null,
    quantity: input.quantity,
    unit_id: input.unit._id,
    unit_price: input.unitPrice,
    discount,
    discount_method: discountMethod,
    tax_method: taxMethod,
    tax_percent: taxRate,
    tax_net: calculated.taxAmount,
    Net_price: calculated.net,
    subtotal: calculated.subtotal,
  }
}

function commercialTotals(
  lines: CommercialLine[],
  options: { discount?: number; shipping?: number; taxRate?: number } = {},
) {
  const discount = options.discount ?? 0
  const shipping = options.shipping ?? 0
  const taxRate = options.taxRate ?? 0
  const totals = calcGrandTotal({
    lineSubtotals: lines.map((line) => line.subtotal),
    orderDiscount: discount,
    orderTaxRate: taxRate,
    shipping,
  })
  return {
    discount,
    shipping,
    TaxNet: totals.taxNet,
    tax_rate: taxRate,
    GrandTotal: totals.grandTotal,
  }
}

async function upsert(Model: any, filter: Record<string, unknown>, values: Record<string, unknown>) {
  return Model.findOneAndUpdate(
    filter,
    { $set: values },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  )
}

async function createBackup() {
  const database = mongoose.connection.db
  if (!database) throw new Error('MongoDB connection did not expose a database')
  const listed = await database.listCollections({}, { nameOnly: true }).toArray()
  const collections: Record<string, unknown[]> = {}
  for (const { name } of listed) {
    collections[name] = await database.collection(name).find({}).toArray()
  }
  const directory = path.resolve('storage', 'backups')
  await mkdir(directory, { recursive: true })
  const file = path.join(
    directory,
    `demo-seed-pre-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  await writeFile(
    file,
    JSON.stringify({ created_at: new Date().toISOString(), database: database.databaseName, collections }, null, 2),
    { encoding: 'utf8', mode: 0o600 },
  )
  return file
}

async function main() {
  console.log('Stocky comprehensive demo dataset')
  console.log('Planned records: 5 products, 3 warehouses, 21 stock rows, 4 purchases, 8 sales, 4 returns, 2 quotations, 2 transfers, 4 adjustments, 4 expenses, and linked payments.')
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to back up and upsert the demo records.')
    return
  }

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env.local')
  await mongoose.connect(process.env.MONGODB_URI)
  const backupFile = await createBackup()
  console.log(`Pre-seed backup: ${backupFile}`)

  const Permission = (await import('../models/Permission')).default
  const Role = (await import('../models/Role')).default
  const User = (await import('../models/User')).default
  const Currency = (await import('../models/Currency')).default
  const Category = (await import('../models/Category')).default
  const Brand = (await import('../models/Brand')).default
  const Unit = (await import('../models/Unit')).default
  const Warehouse = (await import('../models/Warehouse')).default
  const Client = (await import('../models/Client')).default
  const Provider = (await import('../models/Provider')).default
  const Product = (await import('../models/Product')).default
  const ProductWarehouse = (await import('../models/ProductWarehouse')).default
  const Purchase = (await import('../models/Purchase')).default
  const Sale = (await import('../models/Sale')).default
  const Quotation = (await import('../models/Quotation')).default
  const { SaleReturn, PurchaseReturn } = await import('../models/Returns')
  const Transfer = (await import('../models/Transfer')).default
  const Adjustment = (await import('../models/Adjustment')).default
  const { Expense, ExpenseCategory } = await import('../models/Expense')
  const { PaymentSale, PaymentPurchase, PaymentSaleReturn, PaymentPurchaseReturn } = await import('../models/Payments')
  const { Setting, PosSetting, Server, PaymentGatewaySetting, SmsSetting } = await import('../models/Settings')
  const CommunicationLog = (await import('../models/CommunicationLog')).default
  const Counter = (await import('../models/Counter')).default

  const permissions = await Permission.find({})
  if (!permissions.length) throw new Error('Permissions must be imported or seeded before demo data')
  const permissionByName = new Map(permissions.map((permission: any) => [permission.name, permission._id]))
  const managerPermissionNames = [
    'record_view', 'products_view', 'products_add', 'products_edit', 'barcode_view',
    'Purchases_view', 'Purchases_add', 'Purchases_edit', 'Sales_view', 'Sales_add', 'Sales_edit',
    'Quotations_view', 'Quotations_add', 'Sale_Returns_view', 'Sale_Returns_add',
    'Purchase_Returns_view', 'Purchase_Returns_add', 'transfer_view', 'transfer_add',
    'adjustment_view', 'adjustment_add', 'expense_view', 'expense_add', 'Customers_view',
    'Suppliers_view', 'Reports_profit', 'Reports_sales', 'Reports_purchase', 'Warehouse_report',
    'Reports_quantity_alerts', 'Pos_view',
  ]
  const cashierPermissionNames = [
    'products_view', 'barcode_view', 'Sales_view', 'Sales_add', 'payment_sales_view',
    'payment_sales_add', 'Customers_view', 'Customers_add', 'Pos_view',
  ]
  const permissionIds = (names: string[]) => names.map((name) => permissionByName.get(name)).filter(Boolean)
  const managerRole = await upsert(Role, { name: 'Demo Manager' }, {
    name: 'Demo Manager', statut: true, permissions: permissionIds(managerPermissionNames), deletedAt: null,
  })
  const cashierRole = await upsert(Role, { name: 'Demo Cashier' }, {
    name: 'Demo Cashier', statut: true, permissions: permissionIds(cashierPermissionNames), deletedAt: null,
  })
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const manager = await User.findOneAndUpdate(
    { email: 'manager.demo@stocky.local' },
    {
      $set: { name: 'Maya Demo Manager', phone: '+1 555 0101', avatar: 'avatar-default.png', statut: true, roles: [managerRole._id], deletedAt: null },
      $setOnInsert: { email: 'manager.demo@stocky.local', password: passwordHash },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  await User.findOneAndUpdate(
    { email: 'cashier.demo@stocky.local' },
    {
      $set: { name: 'Noah Demo Cashier', phone: '+1 555 0102', avatar: 'avatar-default.png', statut: true, roles: [cashierRole._id], deletedAt: null },
      $setOnInsert: { email: 'cashier.demo@stocky.local', password: passwordHash },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const usd = await upsert(Currency, { code: 'USD' }, { name: 'US Dollar', code: 'USD', symbol: '$', deletedAt: null })
  await upsert(Currency, { code: 'EUR' }, { name: 'Euro', code: 'EUR', symbol: '€', deletedAt: null })
  await upsert(Currency, { code: 'INR' }, { name: 'Indian Rupee', code: 'INR', symbol: '₹', deletedAt: null })

  const electronics = await upsert(Category, { code: 'DMCAT-1001' }, { code: 'DMCAT-1001', name: 'Demo Electronics', deletedAt: null })
  const apparel = await upsert(Category, { code: 'DMCAT-1002' }, { code: 'DMCAT-1002', name: 'Demo Apparel', deletedAt: null })
  const consumables = await upsert(Category, { code: 'DMCAT-1003' }, { code: 'DMCAT-1003', name: 'Demo POS Consumables', deletedAt: null })
  const stockyBrand = await upsert(Brand, { name: 'Demo Stocky Hardware' }, { name: 'Demo Stocky Hardware', description: 'Barcode and point-of-sale hardware used by the demo dataset.', image: '', deletedAt: null })
  const paperBrand = await upsert(Brand, { name: 'Demo PaperWorks' }, { name: 'Demo PaperWorks', description: 'Receipt paper and inventory labels.', image: '', deletedAt: null })
  const textileBrand = await upsert(Brand, { name: 'Demo Northwind Apparel' }, { name: 'Demo Northwind Apparel', description: 'Variant inventory demonstration brand.', image: '', deletedAt: null })

  const piece = await upsert(Unit, { name: 'Piece', short_name: 'pc' }, { name: 'Piece', short_name: 'pc', operator: '*', operator_value: 1, base_unit: null, deletedAt: null }) as UnitDoc
  const box10 = await upsert(Unit, { name: 'Box of 10', short_name: 'box10' }, { name: 'Box of 10', short_name: 'box10', operator: '*', operator_value: 10, base_unit: piece._id, deletedAt: null }) as UnitDoc
  const roll = await upsert(Unit, { name: 'Roll', short_name: 'roll' }, { name: 'Roll', short_name: 'roll', operator: '*', operator_value: 1, base_unit: null, deletedAt: null }) as UnitDoc
  const carton50 = await upsert(Unit, { name: 'Carton of 50', short_name: 'ctn50' }, { name: 'Carton of 50', short_name: 'ctn50', operator: '*', operator_value: 50, base_unit: roll._id, deletedAt: null }) as UnitDoc
  const pack = await upsert(Unit, { name: 'Pack', short_name: 'pack' }, { name: 'Pack', short_name: 'pack', operator: '*', operator_value: 1, base_unit: null, deletedAt: null }) as UnitDoc

  let mainWarehouse = await Warehouse.findOne({ name: 'Main Warehouse', deletedAt: null })
  if (!mainWarehouse) mainWarehouse = await upsert(Warehouse, { name: 'Main Warehouse' }, { name: 'Main Warehouse', city: 'Pune', country: 'India', email: 'warehouse@stocky.local', phone: '+91 20 5550 1000', zip: '411001', deletedAt: null })
  const retailWarehouse = await upsert(Warehouse, { name: 'Demo Retail Outlet' }, { name: 'Demo Retail Outlet', city: 'Pune', country: 'India', email: 'retail.demo@stocky.local', phone: '+91 20 5550 1001', zip: '411014', deletedAt: null })
  const distributionWarehouse = await upsert(Warehouse, { name: 'Demo Distribution Center' }, { name: 'Demo Distribution Center', city: 'Mumbai', country: 'India', email: 'distribution.demo@stocky.local', phone: '+91 22 5550 1002', zip: '400001', deletedAt: null })

  const walkIn = await Client.findOne({ deletedAt: null }).sort({ createdAt: 1 })
  if (!walkIn) throw new Error('At least one client must exist before demo data')
  const acme = await upsert(Client, { code: 'DMCUST-1001', deletedAt: null }, { name: 'Acme Retail Demo', code: 'DMCUST-1001', email: 'buyer@acme-demo.local', phone: '+1 555 0201', country: 'United States', city: 'Austin', address: '101 Market Street', tax_number: 'DEMO-TAX-ACME', deletedAt: null })
  const metro = await upsert(Client, { code: 'DMCUST-1002', deletedAt: null }, { name: 'Metro Market Demo', code: 'DMCUST-1002', email: 'orders@metro-demo.local', phone: '+91 22 5550 2202', country: 'India', city: 'Mumbai', address: '22 Commerce Road', tax_number: 'DEMO-GST-METRO', deletedAt: null })
  const pine = await upsert(Client, { code: 'DMCUST-1003', deletedAt: null }, { name: 'Pine & Co Demo', code: 'DMCUST-1003', email: 'hello@pine-demo.local', phone: '+44 20 7946 0303', country: 'United Kingdom', city: 'London', address: '3 Pine Lane', tax_number: 'DEMO-VAT-PINE', deletedAt: null })
  const hardwareProvider = await upsert(Provider, { code: 'DMSUP-1001', deletedAt: null }, { name: 'Demo Tech Supply', code: 'DMSUP-1001', email: 'sales@techsupply-demo.local', phone: '+1 555 0301', country: 'United States', city: 'Seattle', address: '400 Supply Avenue', tax_number: 'DEMO-TAX-TECH', deletedAt: null })
  const consumableProvider = await upsert(Provider, { code: 'DMSUP-1002', deletedAt: null }, { name: 'Demo Paper Distribution', code: 'DMSUP-1002', email: 'orders@paper-demo.local', phone: '+91 80 5550 0302', country: 'India', city: 'Bengaluru', address: '18 Industrial Estate', tax_number: 'DEMO-GST-PAPER', deletedAt: null })
  const apparelProvider = await upsert(Provider, { code: 'DMSUP-1003', deletedAt: null }, { name: 'Demo Textile Partners', code: 'DMSUP-1003', email: 'wholesale@textile-demo.local', phone: '+91 11 5550 0303', country: 'India', city: 'Delhi', address: '77 Textile Park', tax_number: 'DEMO-GST-TEXTILE', deletedAt: null })

  async function upsertProduct(spec: Record<string, any>) {
    const existing = await Product.findOne({ code: spec.code })
    const existingVariants = new Map<string, any>((existing?.variants ?? []).map((variant: any) => [variant.code, variant]))
    const variants = (spec.variants ?? []).map((variant: { name: string; code: string }) => ({
      _id: existingVariants.get(variant.code)?._id ?? new mongoose.Types.ObjectId(),
      ...variant,
      deletedAt: null,
    }))
    return upsert(Product, { code: spec.code }, { ...spec, variants, is_variant: variants.length > 0, deletedAt: null }) as Promise<ProductDoc>
  }

  const scanner = await upsertProduct({ code: 'DMP-1001', name: 'Demo Wireless Barcode Scanner', barcode_symbology: 'CODE128', category_id: electronics._id, brand_id: stockyBrand._id, unit_id: piece._id, sale_unit_id: piece._id, purchase_unit_id: box10._id, cost: 39.5, price: 69.99, tax_method: '1', TaxNet: 18, note: '2.4 GHz handheld scanner used to demonstrate box-to-piece stock conversion.', image: 'no-image.png', images: [], has_alert: true, alert_quantity: 12, variants: [] })
  const paper = await upsertProduct({ code: 'DMP-1002', name: 'Demo Thermal Receipt Paper 80mm', barcode_symbology: 'CODE128', category_id: consumables._id, brand_id: paperBrand._id, unit_id: roll._id, sale_unit_id: roll._id, purchase_unit_id: carton50._id, cost: 1.2, price: 2.5, tax_method: '1', TaxNet: 5, note: 'Thermal rolls purchased in cartons and sold as individual rolls.', image: 'no-image.png', images: [], has_alert: true, alert_quantity: 50, variants: [] })
  const labels = await upsertProduct({ code: 'DMP-1003', name: 'Demo Inventory Label Pack', barcode_symbology: 'CODE128', category_id: consumables._id, brand_id: paperBrand._id, unit_id: pack._id, sale_unit_id: pack._id, purchase_unit_id: pack._id, cost: 4.5, price: 8.99, tax_method: '2', TaxNet: 12, note: 'Tax-inclusive label pack used to exercise inclusive line calculations.', image: 'no-image.png', images: [], has_alert: true, alert_quantity: 20, variants: [] })
  const shirt = await upsertProduct({ code: 'DMP-1004', name: 'Demo Stocky Staff T-Shirt', barcode_symbology: 'CODE128', category_id: apparel._id, brand_id: textileBrand._id, unit_id: piece._id, sale_unit_id: piece._id, purchase_unit_id: piece._id, cost: 8, price: 18, tax_method: '1', TaxNet: 5, note: 'Variant product with Small, Medium, and Large stock identities.', image: 'no-image.png', images: [], has_alert: true, alert_quantity: 8, variants: [{ name: 'Small', code: 'DMP-1004-S' }, { name: 'Medium', code: 'DMP-1004-M' }, { name: 'Large', code: 'DMP-1004-L' }] })
  const drawer = await upsertProduct({ code: 'DMP-1005', name: 'Demo USB Cash Drawer', barcode_symbology: 'CODE128', category_id: electronics._id, brand_id: stockyBrand._id, unit_id: piece._id, sale_unit_id: piece._id, purchase_unit_id: piece._id, cost: 48, price: 79, tax_method: '1', TaxNet: 18, note: 'POS cash drawer inventory example.', image: 'no-image.png', images: [], has_alert: true, alert_quantity: 5, variants: [] })
  const shirtS = shirt.variants.find((variant) => variant.code === 'DMP-1004-S')!._id
  const shirtM = shirt.variants.find((variant) => variant.code === 'DMP-1004-M')!._id
  const shirtL = shirt.variants.find((variant) => variant.code === 'DMP-1004-L')!._id

  const openingByWarehouse = [
    { warehouse: mainWarehouse, ref: 'AD_9701', quantities: [50, 250, 80, 30, 35, 30, 20] },
    { warehouse: retailWarehouse, ref: 'AD_9702', quantities: [12, 80, 25, 10, 12, 10, 6] },
    { warehouse: distributionWarehouse, ref: 'AD_9703', quantities: [20, 150, 40, 15, 18, 15, 10] },
  ]
  const identities = [
    { product: scanner, variantId: null },
    { product: paper, variantId: null },
    { product: labels, variantId: null },
    { product: shirt, variantId: shirtS },
    { product: shirt, variantId: shirtM },
    { product: shirt, variantId: shirtL },
    { product: drawer, variantId: null },
  ]
  const adjustments: any[] = []
  for (const [index, opening] of openingByWarehouse.entries()) {
    const details = identities.map((identity, identityIndex) => ({
      product_id: identity.product._id,
      variant_id: identity.variantId,
      quantity: opening.quantities[identityIndex],
      type: 'add',
      cost: identity.product.cost,
      subtotal: round2(opening.quantities[identityIndex] * identity.product.cost),
    }))
    adjustments.push(await upsert(Adjustment, { Ref: opening.ref }, { Ref: opening.ref, date: daysAgo(30 - index), warehouse_id: opening.warehouse._id, user_id: manager._id, notes: 'Demo opening balance used as the auditable source of initial warehouse stock.', details, deletedAt: null }))
  }
  const damageDetails = [
    { product_id: paper._id, variant_id: null, quantity: 2, type: 'sub', cost: paper.cost, subtotal: round2(2 * paper.cost) },
    { product_id: shirt._id, variant_id: shirtS, quantity: 1, type: 'sub', cost: shirt.cost, subtotal: shirt.cost },
  ]
  adjustments.push(await upsert(Adjustment, { Ref: 'AD_9704' }, { Ref: 'AD_9704', date: daysAgo(1, 9), warehouse_id: retailWarehouse._id, user_id: manager._id, notes: 'Demo damaged stock write-off.', details: damageDetails, deletedAt: null }))

  const purchaseSpecs = [
    { Ref: 'PR_9101', date: daysAgo(12), provider: hardwareProvider, warehouse: mainWarehouse, status: 'received', lines: [commercialLine({ product: scanner, quantity: 3, unit: box10, unitPrice: 395, discount: 2 }), commercialLine({ product: drawer, quantity: 5, unit: piece, unitPrice: 48 })], header: { discount: 10, shipping: 18, taxRate: 2 }, paid: 500, notes: 'Received hardware purchase with partial supplier payment.' },
    { Ref: 'PR_9102', date: daysAgo(10), provider: apparelProvider, warehouse: distributionWarehouse, status: 'received', lines: [commercialLine({ product: shirt, variantId: shirtM, quantity: 20, unit: piece, unitPrice: 8 }), commercialLine({ product: shirt, variantId: shirtL, quantity: 15, unit: piece, unitPrice: 8 }), commercialLine({ product: labels, quantity: 30, unit: pack, unitPrice: 4.5, taxMethod: '2' })], header: { shipping: 12 }, paid: 'full', notes: 'Received apparel and label replenishment.' },
    { Ref: 'PR_9103', date: daysAgo(4), provider: hardwareProvider, warehouse: retailWarehouse, status: 'pending', lines: [commercialLine({ product: scanner, quantity: 1, unit: box10, unitPrice: 390 })], header: {}, paid: 0, notes: 'Pending order; correctly has no stock effect.' },
    { Ref: 'PR_9104', date: daysAgo(2), provider: consumableProvider, warehouse: mainWarehouse, status: 'received', lines: [commercialLine({ product: paper, quantity: 1, unit: carton50, unitPrice: 60, discount: 1 })], header: { shipping: 5 }, paid: 'full', notes: 'Received receipt-paper carton.' },
  ]
  const purchases: any[] = []
  for (const spec of purchaseSpecs) {
    const totals = commercialTotals(spec.lines, spec.header)
    const paidAmount = spec.paid === 'full' ? totals.GrandTotal : Number(spec.paid)
    purchases.push(await upsert(Purchase, { Ref: spec.Ref }, { Ref: spec.Ref, date: spec.date, provider_id: spec.provider._id, warehouse_id: spec.warehouse._id, user_id: manager._id, status: spec.status, paid_amount: paidAmount, payment_status: calcPaymentStatus(paidAmount, totals.GrandTotal), notes: spec.notes, ...totals, details: spec.lines, deletedAt: null }))
  }

  const saleSpecs = [
    { Ref: 'SL_9201', days: 6, client: acme, warehouse: mainWarehouse, status: 'completed', pos: false, lines: [commercialLine({ product: scanner, quantity: 2, unit: piece, unitPrice: 69.99 }), commercialLine({ product: paper, quantity: 5, unit: roll, unitPrice: 2.5 })], header: { shipping: 4 }, pay: 'full' },
    { Ref: 'SL_9202', days: 5, client: metro, warehouse: retailWarehouse, status: 'completed', pos: true, lines: [commercialLine({ product: shirt, variantId: shirtS, quantity: 2, unit: piece, unitPrice: 18 }), commercialLine({ product: labels, quantity: 3, unit: pack, unitPrice: 8.99, taxMethod: '2' })], header: {}, pay: 20 },
    { Ref: 'SL_9203', days: 4, client: pine, warehouse: mainWarehouse, status: 'completed', pos: false, lines: [commercialLine({ product: drawer, quantity: 1, unit: piece, unitPrice: 79, discount: 5 }), commercialLine({ product: labels, quantity: 5, unit: pack, unitPrice: 8.99, taxMethod: '2' })], header: { discount: 3 }, pay: 'full' },
    { Ref: 'SL_9204', days: 3, client: acme, warehouse: distributionWarehouse, status: 'completed', pos: false, lines: [commercialLine({ product: scanner, quantity: 4, unit: piece, unitPrice: 67.5 }), commercialLine({ product: paper, quantity: 10, unit: roll, unitPrice: 2.35 })], header: { shipping: 7 }, pay: 0 },
    { Ref: 'SL_9205', days: 2, client: metro, warehouse: retailWarehouse, status: 'completed', pos: true, lines: [commercialLine({ product: shirt, variantId: shirtM, quantity: 2, unit: piece, unitPrice: 18 }), commercialLine({ product: paper, quantity: 6, unit: roll, unitPrice: 2.5 })], header: {}, pay: 'full' },
    { Ref: 'SL_9206', days: 1, client: pine, warehouse: mainWarehouse, status: 'completed', pos: false, lines: [commercialLine({ product: scanner, quantity: 1, unit: piece, unitPrice: 69.99 }), commercialLine({ product: shirt, variantId: shirtL, quantity: 1, unit: piece, unitPrice: 18 })], header: {}, pay: 50 },
    { Ref: 'SL_9207', days: 0, client: walkIn, warehouse: retailWarehouse, status: 'completed', pos: true, lines: [commercialLine({ product: labels, quantity: 2, unit: pack, unitPrice: 8.99, taxMethod: '2' }), commercialLine({ product: paper, quantity: 3, unit: roll, unitPrice: 2.5 })], header: {}, pay: 'full' },
    { Ref: 'SL_9208', days: 0, client: acme, warehouse: mainWarehouse, status: 'pending', pos: false, lines: [commercialLine({ product: scanner, quantity: 5, unit: piece, unitPrice: 65 })], header: { shipping: 10 }, pay: 0 },
  ]
  const sales: any[] = []
  for (const spec of saleSpecs) {
    const totals = commercialTotals(spec.lines, spec.header)
    const paidAmount = spec.pay === 'full' ? totals.GrandTotal : Number(spec.pay)
    sales.push(await upsert(Sale, { Ref: spec.Ref }, { Ref: spec.Ref, date: daysAgo(spec.days, spec.pos ? 16 : 11), client_id: spec.client._id, warehouse_id: spec.warehouse._id, user_id: manager._id, status: spec.status, paid_amount: paidAmount, payment_status: calcPaymentStatus(paidAmount, totals.GrandTotal), notes: spec.pos ? 'Demo POS transaction.' : 'Demo sales order.', ...totals, is_pos: spec.pos, details: spec.lines, deletedAt: null }))
  }

  const quotationSpecs = [
    { Ref: 'QT_9301', client: acme, warehouse: mainWarehouse, status: 'sent', date: daysAgo(2), lines: [commercialLine({ product: scanner, quantity: 8, unit: piece, unitPrice: 64, discount: 3 }), commercialLine({ product: drawer, quantity: 2, unit: piece, unitPrice: 75 })] },
    { Ref: 'QT_9302', client: metro, warehouse: retailWarehouse, status: 'pending', date: daysAgo(0), lines: [commercialLine({ product: shirt, variantId: shirtM, quantity: 12, unit: piece, unitPrice: 16.5 }), commercialLine({ product: labels, quantity: 10, unit: pack, unitPrice: 8.25, taxMethod: '2' })] },
  ]
  for (const spec of quotationSpecs) {
    const totals = commercialTotals(spec.lines, { shipping: 8 })
    await upsert(Quotation, { Ref: spec.Ref }, { Ref: spec.Ref, date: spec.date, client_id: spec.client._id, warehouse_id: spec.warehouse._id, user_id: manager._id, status: spec.status, notes: 'Demo quotation; quotations do not mutate stock.', ...totals, details: spec.lines, deletedAt: null })
  }

  const saleReturnSpecs = [
    { Ref: 'RT_9401', client: acme, warehouse: mainWarehouse, status: 'received', date: daysAgo(1), lines: [commercialLine({ product: scanner, quantity: 1, unit: piece, unitPrice: 69.99 })], paid: 'full' },
    { Ref: 'RT_9402', client: metro, warehouse: retailWarehouse, status: 'pending', date: daysAgo(0), lines: [commercialLine({ product: labels, quantity: 1, unit: pack, unitPrice: 8.99, taxMethod: '2' })], paid: 0 },
  ]
  const saleReturns: any[] = []
  for (const spec of saleReturnSpecs) {
    const totals = commercialTotals(spec.lines)
    const paidAmount = spec.paid === 'full' ? totals.GrandTotal : Number(spec.paid)
    saleReturns.push(await upsert(SaleReturn, { Ref: spec.Ref }, { Ref: spec.Ref, date: spec.date, client_id: spec.client._id, warehouse_id: spec.warehouse._id, user_id: manager._id, status: spec.status, paid_amount: paidAmount, payment_status: calcPaymentStatus(paidAmount, totals.GrandTotal), notes: 'Demo customer return.', ...totals, details: spec.lines, deletedAt: null }))
  }
  const purchaseReturnSpecs = [
    { Ref: 'RT_9501', provider: consumableProvider, warehouse: mainWarehouse, status: 'completed', date: daysAgo(1), lines: [commercialLine({ product: paper, quantity: 10, unit: roll, unitPrice: 1.2 })], paid: 'full' },
    { Ref: 'RT_9502', provider: hardwareProvider, warehouse: mainWarehouse, status: 'pending', date: daysAgo(0), lines: [commercialLine({ product: drawer, quantity: 1, unit: piece, unitPrice: 48 })], paid: 0 },
  ]
  const purchaseReturns: any[] = []
  for (const spec of purchaseReturnSpecs) {
    const totals = commercialTotals(spec.lines)
    const paidAmount = spec.paid === 'full' ? totals.GrandTotal : Number(spec.paid)
    purchaseReturns.push(await upsert(PurchaseReturn, { Ref: spec.Ref }, { Ref: spec.Ref, date: spec.date, provider_id: spec.provider._id, warehouse_id: spec.warehouse._id, user_id: manager._id, status: spec.status, paid_amount: paidAmount, payment_status: calcPaymentStatus(paidAmount, totals.GrandTotal), notes: 'Demo supplier return.', ...totals, details: spec.lines, deletedAt: null }))
  }

  const completedTransferLines = [
    { product_id: scanner._id, variant_id: null, quantity: 5, unit_id: piece._id, Net_price: scanner.cost, subtotal: round2(5 * scanner.cost) },
    { product_id: paper._id, variant_id: null, quantity: 20, unit_id: roll._id, Net_price: paper.cost, subtotal: round2(20 * paper.cost) },
    { product_id: shirt._id, variant_id: shirtM, quantity: 3, unit_id: piece._id, Net_price: shirt.cost, subtotal: round2(3 * shirt.cost) },
  ]
  await upsert(Transfer, { Ref: 'TR_9601' }, { Ref: 'TR_9601', date: daysAgo(2), from_warehouse_id: mainWarehouse._id, to_warehouse_id: retailWarehouse._id, user_id: manager._id, status: 'completed', notes: 'Demo completed replenishment transfer.', shipping: 6, GrandTotal: round2(completedTransferLines.reduce((sum, line) => sum + line.subtotal, 0) + 6), details: completedTransferLines, deletedAt: null })
  await upsert(Transfer, { Ref: 'TR_9602' }, { Ref: 'TR_9602', date: daysAgo(0), from_warehouse_id: distributionWarehouse._id, to_warehouse_id: mainWarehouse._id, user_id: manager._id, status: 'pending', notes: 'Demo pending transfer; no stock effect yet.', shipping: 3, GrandTotal: round2(drawer.cost * 2 + 3), details: [{ product_id: drawer._id, variant_id: null, quantity: 2, unit_id: piece._id, Net_price: drawer.cost, subtotal: drawer.cost * 2 }], deletedAt: null })

  const rent = await upsert(ExpenseCategory, { name: 'Demo Rent' }, { name: 'Demo Rent', description: 'Recurring facility expense examples.', deletedAt: null })
  const utilities = await upsert(ExpenseCategory, { name: 'Demo Utilities' }, { name: 'Demo Utilities', description: 'Electricity and connectivity examples.', deletedAt: null })
  const logistics = await upsert(ExpenseCategory, { name: 'Demo Logistics' }, { name: 'Demo Logistics', description: 'Local delivery and freight examples.', deletedAt: null })
  const expenseSpecs = [
    { Ref: 'EXP_9801', date: daysAgo(6), warehouse: mainWarehouse, category: rent, amount: 950, details: 'Demo monthly warehouse rent.' },
    { Ref: 'EXP_9802', date: daysAgo(4), warehouse: retailWarehouse, category: utilities, amount: 125.5, details: 'Demo electricity and internet charge.' },
    { Ref: 'EXP_9803', date: daysAgo(2), warehouse: distributionWarehouse, category: logistics, amount: 78.25, details: 'Demo local freight expense.' },
    { Ref: 'EXP_9804', date: daysAgo(0), warehouse: mainWarehouse, category: utilities, amount: 64.75, details: 'Demo warehouse utility expense.' },
  ]
  for (const spec of expenseSpecs) await upsert(Expense, { Ref: spec.Ref }, { Ref: spec.Ref, date: spec.date, warehouse_id: spec.warehouse._id, category_id: spec.category._id, user_id: manager._id, amount: spec.amount, details: spec.details, deletedAt: null })

  for (const [index, sale] of sales.entries()) {
    if (sale.paid_amount <= 0) continue
    await upsert(PaymentSale, { Ref: `INV/SL_${9901 + index}` }, { Ref: `INV/SL_${9901 + index}`, date: sale.date, sale_id: sale._id, user_id: manager._id, montant: sale.paid_amount, change: 0, payment_method: sale.is_pos ? 'cash' : index % 2 ? 'card' : 'bank_transfer', notes: 'Demo sale payment.', deletedAt: null })
  }
  for (const [index, purchase] of purchases.entries()) {
    if (purchase.paid_amount <= 0) continue
    await upsert(PaymentPurchase, { Ref: `INV/PR_${9911 + index}` }, { Ref: `INV/PR_${9911 + index}`, date: purchase.date, purchase_id: purchase._id, user_id: manager._id, montant: purchase.paid_amount, change: 0, payment_method: 'bank_transfer', notes: 'Demo supplier payment.', deletedAt: null })
  }
  await upsert(PaymentSaleReturn, { Ref: 'INV/RT_9921' }, { Ref: 'INV/RT_9921', date: saleReturns[0].date, sale_return_id: saleReturns[0]._id, user_id: manager._id, montant: saleReturns[0].paid_amount, change: 0, payment_method: 'cash', notes: 'Demo customer refund.', deletedAt: null })
  await upsert(PaymentPurchaseReturn, { Ref: 'INV/RT_9931' }, { Ref: 'INV/RT_9931', date: purchaseReturns[0].date, purchase_return_id: purchaseReturns[0]._id, user_id: manager._id, montant: purchaseReturns[0].paid_amount, change: 0, payment_method: 'bank_transfer', notes: 'Demo supplier refund receipt.', deletedAt: null })

  const stock = new Map<string, number>()
  const stockKey = (productId: unknown, warehouseId: unknown, variantId: unknown) => `${productId}|${warehouseId}|${variantId ?? 'base'}`
  const changeStock = (productId: unknown, warehouseId: unknown, variantId: unknown, quantity: number) => {
    const key = stockKey(productId, warehouseId, variantId)
    stock.set(key, round2((stock.get(key) ?? 0) + quantity))
  }
  for (const opening of openingByWarehouse) {
    identities.forEach((identity, index) => changeStock(identity.product._id, opening.warehouse._id, identity.variantId, opening.quantities[index]))
  }
  changeStock(paper._id, retailWarehouse._id, null, -2)
  changeStock(shirt._id, retailWarehouse._id, shirtS, -1)
  const unitMap = new Map<string, UnitDoc>([piece, box10, roll, carton50, pack].map((unit) => [String(unit._id), unit]))
  const applyLines = (lines: any[], warehouseId: unknown, sign: number) => {
    for (const line of lines) {
      const unit = unitMap.get(String(line.unit_id))
      if (!unit) throw new Error(`Missing demo unit ${line.unit_id}`)
      changeStock(line.product_id, warehouseId, line.variant_id, sign * toBaseQty(line.quantity, unit))
    }
  }
  purchaseSpecs.filter((spec) => spec.status === 'received').forEach((spec) => applyLines(spec.lines, spec.warehouse._id, 1))
  saleSpecs.filter((spec) => spec.status === 'completed').forEach((spec) => applyLines(spec.lines, spec.warehouse._id, -1))
  saleReturnSpecs.filter((spec) => spec.status === 'received').forEach((spec) => applyLines(spec.lines, spec.warehouse._id, 1))
  purchaseReturnSpecs.filter((spec) => spec.status === 'completed').forEach((spec) => applyLines(spec.lines, spec.warehouse._id, -1))
  applyLines(completedTransferLines, mainWarehouse._id, -1)
  applyLines(completedTransferLines, retailWarehouse._id, 1)
  for (const [key, quantity] of stock) {
    if (quantity < 0) throw new Error(`Demo ledger produced negative stock for ${key}: ${quantity}`)
    const [productId, warehouseId, variantPart] = key.split('|')
    await upsert(ProductWarehouse, { product_id: productId, warehouse_id: warehouseId, variant_id: variantPart === 'base' ? null : variantPart, deletedAt: null }, { product_id: productId, warehouse_id: warehouseId, variant_id: variantPart === 'base' ? null : variantPart, qte: quantity, deletedAt: null })
  }

  const setting = await Setting.findOne({})
  if (setting) {
    await Setting.updateOne({ _id: setting._id }, { $set: { currency_id: setting.currency_id ?? usd._id, client_id: setting.client_id ?? walkIn._id, warehouse_id: setting.warehouse_id ?? mainWarehouse._id } })
  } else {
    await Setting.create({ CompanyName: 'Stocky Demo', CompanyPhone: '', CompanyAdress: '', email: 'admin@example.com', logo: 'logo-default.png', footer: 'Stocky - Ultimate Inventory with POS', developed_by: 'Stocky', currency_id: usd._id, client_id: walkIn._id, warehouse_id: mainWarehouse._id, default_language: 'en' })
  }
  if (!(await PosSetting.exists({}))) await PosSetting.create({})
  if (!(await Server.exists({}))) await Server.create({ name: 'default', smtp_host: '', smtp_port: 587, encryption: 'tls', smtp_username: '', smtp_password: '', smtp_email: '' })
  await upsert(PaymentGatewaySetting, { provider: 'stripe' }, { provider: 'stripe', enabled: false, public_key: '', secret_key: '', currency: 'USD' })
  await upsert(SmsSetting, { provider: 'twilio' }, { provider: 'twilio', enabled: false, account_sid: '', auth_token: '', from_number: '' })
  await upsert(CommunicationLog, { idempotency_key: 'demo:sale:SL_9201:email' }, { idempotency_key: 'demo:sale:SL_9201:email', channel: 'email', resource: 'sale', document_id: sales[0]._id, user_id: manager._id, recipient_masked: 'b***r@acme-demo.local', status: 'pending', provider_id: '', error: '' })
  await upsert(CommunicationLog, { idempotency_key: 'demo:sale:SL_9202:sms' }, { idempotency_key: 'demo:sale:SL_9202:sms', channel: 'sms', resource: 'sale', document_id: sales[1]._id, user_id: manager._id, recipient_masked: '+91******2202', status: 'failed', provider_id: '', error: 'Demo record: SMS provider intentionally disabled.' })

  const counterValues: Record<string, number> = {
    'reference:purchase': 9104, 'reference:sale': 9208, 'reference:quotation': 9302,
    'reference:saleReturn': 9402, 'reference:purchaseReturn': 9502,
    'reference:transfer': 9602, 'reference:adjustment': 9704, 'reference:expense': 9804,
    'reference:paymentSale': 9908, 'reference:paymentPurchase': 9914,
    'reference:paymentSaleReturn': 9921, 'reference:paymentPurchaseReturn': 9931,
    'code:product': 1005, 'code:category': 1003, 'code:client': 1003, 'code:provider': 1003,
  }
  for (const [id, sequence] of Object.entries(counterValues)) {
    await Counter.updateOne({ _id: id }, { $max: { sequence } }, { upsert: true })
  }

  const paymentChecks = [
    [Sale, PaymentSale, 'sale_id', /^SL_92/],
    [Purchase, PaymentPurchase, 'purchase_id', /^PR_91/],
    [SaleReturn, PaymentSaleReturn, 'sale_return_id', /^RT_94/],
    [PurchaseReturn, PaymentPurchaseReturn, 'purchase_return_id', /^RT_95/],
  ] as const
  for (const [Parent, Payment, parentField, refPattern] of paymentChecks) {
    const parents = await Parent.find({ Ref: refPattern, deletedAt: null }).lean()
    for (const parent of parents) {
      const rows = await Payment.find({ [parentField]: parent._id, deletedAt: null }).lean()
      const sum = round2(rows.reduce((total: number, payment: any) => total + payment.montant, 0))
      if (sum !== round2(parent.paid_amount)) throw new Error(`${parent.Ref} paid amount ${parent.paid_amount} does not match payments ${sum}`)
      if (parent.payment_status !== calcPaymentStatus(sum, parent.GrandTotal)) throw new Error(`${parent.Ref} has an invalid payment status`)
    }
  }
  for (const [key, expected] of stock) {
    const [productId, warehouseId, variantPart] = key.split('|')
    const row: any = await ProductWarehouse.findOne({ product_id: productId, warehouse_id: warehouseId, variant_id: variantPart === 'base' ? null : variantPart, deletedAt: null }).lean()
    if (!row || round2(row.qte) !== expected) throw new Error(`Stock verification failed for ${key}`)
  }

  const database = mongoose.connection.db!
  const collectionNames = ['users', 'roles', 'permissions', 'currencies', 'categories', 'brands', 'units', 'warehouses', 'clients', 'providers', 'products', 'productwarehouses', 'purchases', 'sales', 'quotations', 'salereturns', 'purchasereturns', 'transfers', 'adjustments', 'expensecategories', 'expenses', 'paymentsales', 'paymentpurchases', 'paymentsalereturns', 'paymentpurchasereturns', 'settings', 'possettings', 'servers', 'paymentgatewaysettings', 'smssettings', 'communicationlogs', 'counters']
  const counts: Record<string, number> = {}
  for (const name of collectionNames) counts[name] = await database.collection(name).countDocuments({})
  const emptyCollections = Object.entries(counts).filter(([, count]) => count === 0).map(([name]) => name)
  if (emptyCollections.length) throw new Error(`Model collections still empty: ${emptyCollections.join(', ')}`)

  console.log(JSON.stringify({
    status: 'complete',
    backup_file: backupFile,
    demo_login: ['manager.demo@stocky.local', 'cashier.demo@stocky.local'],
    demo_password: DEMO_PASSWORD,
    verified_stock_rows: stock.size,
    collection_counts: counts,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  })
