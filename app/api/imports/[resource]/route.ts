import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import Papa from 'papaparse'
import { ZodError } from 'zod'
import dbConnect from '@/lib/db'
import { startTransactionSession } from '@/lib/transactions'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { nextNumericCode } from '@/lib/references'
import { personSchema, productSchema } from '@/lib/validation'
import Product from '@/models/Product'
import ProductWarehouse from '@/models/ProductWarehouse'
import Category from '@/models/Category'
import Brand from '@/models/Brand'
import Unit from '@/models/Unit'
import Warehouse from '@/models/Warehouse'
import Client from '@/models/Client'
import Provider from '@/models/Provider'

export const dynamic = 'force-dynamic'

type ImportResource = 'products' | 'customers' | 'suppliers'

const PERMISSIONS: Record<ImportResource, string> = {
  products: 'product_import',
  customers: 'customers_import',
  suppliers: 'Suppliers_import',
}

function numeric(value: string | undefined, field: string, row: number) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed) || parsed < 0) throw new ApiError(422, `Row ${row}: ${field} must be a non-negative number`)
  return parsed
}

function exactPattern(value: string) {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
}

function rowError(error: unknown, row: number): never {
  if (error instanceof ApiError) throw error
  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new ApiError(422, `Row ${row}: ${message}`)
  }
  throw error
}

async function importPeople(resource: 'customers' | 'suppliers', rows: Record<string, string>[], session: mongoose.ClientSession) {
  const Model = resource === 'customers' ? Client : Provider
  const type = resource === 'customers' ? 'client' : 'provider'
  const batchEmails = new Set<string>()
  for (let index = 0; index < rows.length; index += 1) {
    try {
      const row = rows[index]
      const email = (row.email ?? '').trim().toLowerCase()
      if (email) {
        if (batchEmails.has(email) || await Model.exists({ email, deletedAt: null }).session(session)) {
          throw new ApiError(409, `Row ${index + 2}: email already exists`)
        }
        batchEmails.add(email)
      }
      const data = personSchema.parse({
        name: row.name,
        code: row.code ?? '',
        email,
        phone: row.phone ?? '',
        country: row.country ?? '',
        city: row.city ?? '',
        address: row.address ?? row.adresse ?? '',
        tax_number: row.tax_number ?? '',
      })
      const code = data.code || await nextNumericCode(type, session)
      await Model.create([{ ...data, code }], { session })
    } catch (error) {
      rowError(error, index + 2)
    }
  }
}

async function importProducts(rows: Record<string, string>[], session: mongoose.ClientSession) {
  const [units, warehouses] = await Promise.all([
    Unit.find({ deletedAt: null }).session(session).lean(),
    Warehouse.find({ deletedAt: null }).select('_id').session(session).lean(),
  ])
  const unitMap = new Map<string, any>()
  for (const unit of units as any[]) {
    unitMap.set(unit.name.toLowerCase(), unit)
    unitMap.set(unit.short_name.toLowerCase(), unit)
  }
  const categories = new Map<string, any>()
  const brands = new Map<string, any>()

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const row = rows[index]
      const categoryName = (row.category ?? '').trim()
      const unitName = (row.unit ?? '').trim().toLowerCase()
      if (!categoryName) throw new ApiError(422, `Row ${index + 2}: category is required`)
      const unit = unitMap.get(unitName)
      if (!unit) throw new ApiError(422, `Row ${index + 2}: unit "${row.unit ?? ''}" does not exist`)

      const categoryKey = categoryName.toLowerCase()
      let category = categories.get(categoryKey)
      if (!category) {
        category = await Category.findOne({ name: { $regex: exactPattern(categoryName), $options: 'i' }, deletedAt: null }).session(session)
        if (!category) {
          const code = await nextNumericCode('category', session)
          ;[category] = await Category.create([{ name: categoryName, code }], { session })
        }
        categories.set(categoryKey, category)
      }

      let brand: any = null
      const brandName = (row.brand ?? '').trim()
      if (brandName && brandName.toUpperCase() !== 'N/A') {
        const brandKey = brandName.toLowerCase()
        brand = brands.get(brandKey)
        if (!brand) {
          brand = await Brand.findOne({ name: { $regex: exactPattern(brandName), $options: 'i' }, deletedAt: null }).session(session)
          if (!brand) [brand] = await Brand.create([{ name: brandName }], { session })
          brands.set(brandKey, brand)
        }
      }

      const code = (row.code ?? '').trim() || await nextNumericCode('product', session)
      if (await Product.exists({ code }).session(session)) throw new ApiError(409, `Row ${index + 2}: product code already exists`)
      const alertQuantity = numeric(row.stock_alert, 'stock_alert', index + 2)
      const data = productSchema.parse({
        code,
        name: row.name,
        barcode_symbology: 'CODE128',
        category_id: String(category._id),
        brand_id: brand ? String(brand._id) : null,
        unit_id: String(unit._id),
        sale_unit_id: String(unit._id),
        purchase_unit_id: String(unit._id),
        cost: numeric(row.cost, 'cost', index + 2),
        price: numeric(row.price, 'price', index + 2),
        tax_method: '1',
        TaxNet: 0,
        note: row.note ?? '',
        image: 'no-image.png',
        images: [],
        is_variant: false,
        has_alert: alertQuantity > 0,
        alert_quantity: alertQuantity,
        variants: [],
      })
      const [product] = await Product.create([data], { session })
      if (warehouses.length) {
        await ProductWarehouse.insertMany(warehouses.map((warehouse: any) => ({
          product_id: product._id,
          warehouse_id: warehouse._id,
          variant_id: null,
          qte: 0,
        })), { session })
      }
    } catch (error) {
      rowError(error, index + 2)
    }
  }
}

export const POST = withErrorHandler(async (request: Request, context: { params: { resource: string } }) => {
  const resource = context.params.resource as ImportResource
  if (!(resource in PERMISSIONS)) throw new ApiError(404, 'Unknown import resource')
  const user = await requireSession()
  await requirePermission(user, PERMISSIONS[resource])
  await dbConnect()

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'A CSV file is required')
  if (!file.name.toLowerCase().endsWith('.csv')) throw new ApiError(422, 'The import file must use the .csv extension')
  if (file.size > 2 * 1024 * 1024) throw new ApiError(413, 'The CSV file cannot exceed 2 MB')

  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim().toLowerCase(),
    transform: (value) => value.trim(),
  })
  if (parsed.errors.length) throw new ApiError(422, `CSV parse error: ${parsed.errors[0].message}`)
  if (!parsed.data.length) throw new ApiError(422, 'The CSV file contains no records')
  if (parsed.data.length > 2000) throw new ApiError(413, 'A single import is limited to 2,000 records')

  const session = await startTransactionSession()
  try {
    if (resource === 'products') await importProducts(parsed.data, session)
    else await importPeople(resource, parsed.data, session)
    await session.commitTransaction()
    return NextResponse.json({ message: `${parsed.data.length} records imported`, imported: parsed.data.length })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
})
