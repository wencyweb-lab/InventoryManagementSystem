import mongoose, { type ClientSession } from 'mongoose'
import { ApiError } from '@/lib/permissions'
import Unit from '@/models/Unit'
import Product from '@/models/Product'
import Category from '@/models/Category'
import Brand from '@/models/Brand'
import Warehouse from '@/models/Warehouse'
import { Expense, ExpenseCategory } from '@/models/Expense'
import { Setting } from '@/models/Settings'

export async function validateExpenseReferences(body: any, session: ClientSession | null = null) {
  if (!await Warehouse.exists({ _id: body.warehouse_id, deletedAt: null }).session(session)) throw new ApiError(422, 'Warehouse does not exist')
  if (!await ExpenseCategory.exists({ _id: body.category_id, deletedAt: null }).session(session)) throw new ApiError(422, 'Expense category does not exist')
}

const documentCollections = ['sales', 'purchases', 'quotations', 'salereturns', 'purchasereturns', 'transfers', 'adjustments']

export async function hasDocumentReference(field: string, ids: unknown[], session?: ClientSession) {
  const objectIds = ids.map(id => new mongoose.Types.ObjectId(String(id)))
  for (const collection of documentCollections) {
    if (await mongoose.connection.db!.collection(collection).findOne({ deletedAt: null, [field]: { $in: objectIds } }, { session, projection: { _id: 1 } })) return true
  }
  return false
}

export async function validateProductReferences(body: any, session: ClientSession, currentProductId?: string) {
  const base = await Unit.findOne({ _id: body.unit_id, deletedAt: null, base_unit: null }).session(session)
  if (!base) throw new ApiError(422, 'Select an active base unit')
  for (const id of [body.sale_unit_id, body.purchase_unit_id].filter(Boolean)) {
    const unit = await Unit.findOne({ _id: id, deletedAt: null }).session(session)
    if (!unit || String(unit.base_unit ?? unit._id) !== String(base._id)) throw new ApiError(422, 'Sale and purchase units must belong to the product base unit')
  }
  if (body.category_id && !await Category.exists({ _id: body.category_id, deletedAt: null }).session(session)) throw new ApiError(422, 'Category does not exist')
  if (body.brand_id && !await Brand.exists({ _id: body.brand_id, deletedAt: null }).session(session)) throw new ApiError(422, 'Brand does not exist')
  const codes = (body.variants || []).map((variant: any) => variant.code?.trim()).filter(Boolean)
  if (new Set(codes).size !== codes.length) throw new ApiError(422, 'Variant barcodes must be unique')
  if (body.code && codes.includes(body.code.trim())) throw new ApiError(422, 'Variant code cannot be the same as the product code')

  const productCode = body.code?.trim()
  const excludeFilter = currentProductId ? { _id: { $ne: currentProductId } } : {}

  if (productCode) {
    const codeInProduct = await Product.exists({ code: productCode, ...excludeFilter, deletedAt: null }).session(session)
    if (codeInProduct) throw new ApiError(409, `Product code "${productCode}" is already in use`)
    const codeInVariant = await Product.exists({ 'variants.code': productCode, ...excludeFilter, deletedAt: null }).session(session)
    if (codeInVariant) throw new ApiError(409, `Product code "${productCode}" is already in use by a product variant`)
  }

  if (codes.length > 0) {
    const variantInProduct = await Product.exists({ code: { $in: codes }, ...excludeFilter, deletedAt: null }).session(session)
    if (variantInProduct) throw new ApiError(409, 'One or more variant barcodes are already in use as a product code')
    const variantInVariant = await Product.exists({ 'variants.code': { $in: codes }, ...excludeFilter, deletedAt: null }).session(session)
    if (variantInVariant) throw new ApiError(409, 'One or more variant barcodes are already in use by another product variant')
  }
}

export async function validateUnit(body: any, id?: string) {
  if (body.base_unit) {
    if (body.base_unit === id) throw new ApiError(422, 'A unit cannot be its own base')
    if (!await Unit.exists({ _id: body.base_unit, deletedAt: null, base_unit: null })) throw new ApiError(422, 'Select an active base unit; nested conversions are not supported')
  }
  if (!id) return
  const old = await Unit.findOne({ _id: id, deletedAt: null })
  if (!old) throw new ApiError(404, 'Unit not found')
  if (String(old.base_unit ?? '') !== String(body.base_unit ?? '') || old.operator !== body.operator || old.operator_value !== body.operator_value) {
    if (await Product.exists({ deletedAt: null, $or: [{ unit_id: id }, { sale_unit_id: id }, { purchase_unit_id: id }] }) ||
      await Unit.exists({ base_unit: id, deletedAt: null }) || await hasDocumentReference('details.unit_id', [id])) {
      throw new ApiError(409, 'An in-use unit conversion cannot be changed. Create a new unit instead.')
    }
  }
}

export async function guardResourceDeletion(model: string, ids: string[]) {
  if (model === 'Client' || model === 'Provider') {
    const field = model === 'Client' ? 'client_id' : 'provider_id'
    if (await hasDocumentReference(field, ids)) throw new ApiError(409, `${model} is referenced by documents`)
    if (model === 'Client' && await Setting.exists({ client_id: { $in: ids } })) throw new ApiError(409, 'Customer is selected in system settings')
  }
  if (model === 'Currency' && await Setting.exists({ currency_id: { $in: ids } })) throw new ApiError(409, 'Currency is selected in system settings')
  if (model === 'ExpenseCategory' && await Expense.exists({ category_id: { $in: ids }, deletedAt: null })) throw new ApiError(409, 'Category is used by expenses')
  if (model === 'Unit') {
    if (await Product.exists({ deletedAt: null, $or: [{ unit_id: { $in: ids } }, { sale_unit_id: { $in: ids } }, { purchase_unit_id: { $in: ids } }] }) ||
      await Unit.exists({ base_unit: { $in: ids }, deletedAt: null }) || await hasDocumentReference('details.unit_id', ids)) throw new ApiError(409, 'Units used by products, derived units or documents cannot be deleted')
  }
  const productField = model === 'Category' ? 'category_id' : model === 'Brand' ? 'brand_id' : null
  if (productField && await Product.exists({ [productField]: { $in: ids }, deletedAt: null })) throw new ApiError(409, `${model} is used by products`)
}
