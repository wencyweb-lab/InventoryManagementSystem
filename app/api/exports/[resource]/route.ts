import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import dbConnect from '@/lib/db'
import { ApiError, recordScopeFilter, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import Product from '@/models/Product'
import ProductWarehouse from '@/models/ProductWarehouse'
import Client from '@/models/Client'
import Provider from '@/models/Provider'
import Purchase from '@/models/Purchase'
import Sale from '@/models/Sale'
import Quotation from '@/models/Quotation'
import { PurchaseReturn, SaleReturn } from '@/models/Returns'
import Transfer from '@/models/Transfer'
import Adjustment from '@/models/Adjustment'
import { Expense } from '@/models/Expense'
import { PaymentPurchase, PaymentPurchaseReturn, PaymentSale, PaymentSaleReturn } from '@/models/Payments'
import User from '@/models/User'
import '@/models/Warehouse'
import '@/models/Role'

export const dynamic = 'force-dynamic'

const CONFIG: Record<string, { model: any; permission: string; scoped?: boolean; populate?: string; filename: string }> = {
  products: { model: Product, permission: 'products_view', populate: 'category_id brand_id unit_id', filename: 'Products' },
  customers: { model: Client, permission: 'Customers_view', filename: 'Customers' },
  suppliers: { model: Provider, permission: 'Suppliers_view', filename: 'Suppliers' },
  purchases: { model: Purchase, permission: 'Purchases_view', scoped: true, populate: 'provider_id warehouse_id user_id', filename: 'Purchases' },
  sales: { model: Sale, permission: 'Sales_view', scoped: true, populate: 'client_id warehouse_id user_id', filename: 'Sales' },
  quotations: { model: Quotation, permission: 'Quotations_view', scoped: true, populate: 'client_id warehouse_id user_id', filename: 'Quotations' },
  'sale-returns': { model: SaleReturn, permission: 'Sale_Returns_view', scoped: true, populate: 'client_id warehouse_id user_id', filename: 'Sale_Returns' },
  'purchase-returns': { model: PurchaseReturn, permission: 'Purchase_Returns_view', scoped: true, populate: 'provider_id warehouse_id user_id', filename: 'Purchase_Returns' },
  transfers: { model: Transfer, permission: 'transfer_view', scoped: true, populate: 'from_warehouse_id to_warehouse_id user_id', filename: 'Transfers' },
  adjustments: { model: Adjustment, permission: 'adjustment_view', scoped: true, populate: 'warehouse_id user_id', filename: 'Adjustments' },
  expenses: { model: Expense, permission: 'expense_view', scoped: true, populate: 'category_id warehouse_id user_id', filename: 'Expenses' },
  'payments-sales': { model: PaymentSale, permission: 'payment_sales_view', scoped: true, populate: 'sale_id user_id', filename: 'Sale_Payments' },
  'payments-purchases': { model: PaymentPurchase, permission: 'payment_purchases_view', scoped: true, populate: 'purchase_id user_id', filename: 'Purchase_Payments' },
  'payments-sale-returns': { model: PaymentSaleReturn, permission: 'payment_returns_view', scoped: true, populate: 'sale_return_id user_id', filename: 'Sale_Return_Payments' },
  'payments-purchase-returns': { model: PaymentPurchaseReturn, permission: 'payment_returns_view', scoped: true, populate: 'purchase_return_id user_id', filename: 'Purchase_Return_Payments' },
  users: { model: User, permission: 'users_view', populate: 'roles', filename: 'Users' },
}

function name(value: any) {
  return value?.name ?? ''
}

function safeCell(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`
  return value ?? ''
}

function documentRow(document: any) {
  return {
    Reference: document.Ref,
    Date: document.date,
    Customer: name(document.client_id),
    Supplier: name(document.provider_id),
    Warehouse: name(document.warehouse_id),
    Status: document.status,
    'Payment status': document.payment_status,
    'Paid amount': document.paid_amount,
    Discount: document.discount,
    Tax: document.TaxNet,
    Shipping: document.shipping,
    'Grand total': document.GrandTotal,
    Lines: document.details?.length ?? 0,
    User: name(document.user_id),
    Notes: document.notes,
  }
}

function rowFor(resource: string, document: any, stocks: Map<string, number>) {
  if (resource === 'products') return {
    Code: document.code,
    Name: document.name,
    Category: name(document.category_id),
    Brand: name(document.brand_id),
    Cost: document.cost,
    Price: document.price,
    Unit: document.unit_id?.short_name ?? document.unit_id?.name ?? '',
    'Stock (base unit)': stocks.get(String(document._id)) ?? 0,
    'Alert quantity': document.alert_quantity,
    'Has alert': document.has_alert ? 'Yes' : 'No',
    Variants: document.variants?.filter((item: any) => !item.deletedAt).map((item: any) => `${item.name} (${item.code})`).join(', ') ?? '',
    Note: document.note,
  }
  if (resource === 'customers' || resource === 'suppliers') return {
    Code: document.code,
    Name: document.name,
    Email: document.email,
    Phone: document.phone,
    Country: document.country,
    City: document.city,
    Address: document.address,
    'Tax number': document.tax_number,
  }
  if (resource === 'users') return {
    Name: document.name,
    Email: document.email,
    Phone: document.phone,
    Active: document.statut ? 'Yes' : 'No',
    Roles: document.roles?.map(name).join(', ') ?? '',
  }
  if (resource === 'transfers') return {
    Reference: document.Ref,
    Date: document.date,
    From: name(document.from_warehouse_id),
    To: name(document.to_warehouse_id),
    Status: document.status,
    Shipping: document.shipping,
    'Grand total': document.GrandTotal,
    Lines: document.details?.length ?? 0,
    User: name(document.user_id),
    Notes: document.notes,
  }
  if (resource === 'adjustments') return {
    Reference: document.Ref,
    Date: document.date,
    Warehouse: name(document.warehouse_id),
    Lines: document.details?.length ?? 0,
    User: name(document.user_id),
    Notes: document.notes,
  }
  if (resource === 'expenses') return {
    Reference: document.Ref,
    Date: document.date,
    Category: name(document.category_id),
    Warehouse: name(document.warehouse_id),
    Amount: document.amount,
    Details: document.details,
    User: name(document.user_id),
  }
  if (resource.startsWith('payments-')) return {
    Reference: document.Ref,
    Date: document.date,
    'Document reference': document.sale_id?.Ref ?? document.purchase_id?.Ref ?? document.sale_return_id?.Ref ?? document.purchase_return_id?.Ref ?? '',
    Amount: document.montant,
    Change: document.change,
    Method: document.payment_method,
    User: name(document.user_id),
    Notes: document.notes,
  }
  return documentRow(document)
}

export const GET = withErrorHandler(async (_req: Request, context: { params: { resource: string } }) => {
  const user = await requireSession()
  const resource = context.params.resource
  const config = CONFIG[resource]
  if (!config) throw new ApiError(404, 'Unknown export resource')
  await requirePermission(user, config.permission)
  await dbConnect()

  const filter = { deletedAt: null, ...(config.scoped ? recordScopeFilter(user) : {}) }
  let query = config.model.find(filter).sort({ createdAt: -1 }).limit(10000)
  if (config.populate) query = query.populate(config.populate)
  if (resource === 'users') query = query.select('-password')
  const documents = await query.lean()

  const stocks = new Map<string, number>()
  if (resource === 'products') {
    const rows = await ProductWarehouse.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$product_id', quantity: { $sum: '$qte' } } },
    ])
    for (const row of rows) stocks.set(String(row._id), row.quantity)
  }

  const rows = documents.map((document: any) => Object.fromEntries(
    Object.entries(rowFor(resource, document, stocks)).map(([key, value]) => [key, safeCell(value)])
  ))
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No records found' }])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, config.filename.slice(0, 31))
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer

  return new NextResponse(new Uint8Array(output), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${config.filename}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
})
