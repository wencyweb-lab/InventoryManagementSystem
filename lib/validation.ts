import { z } from 'zod'
import { calcGrandTotal, calcLine, round2 } from '@/lib/calculations'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')
export const optionalObjectIdSchema = z
  .union([objectIdSchema, z.literal(''), z.null(), z.undefined()])
  .transform((value) => value || null)

const finiteNonNegative = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER / 10000)
const percentage = z.number().finite().min(0).max(100)
const documentDate = z.union([z.string().trim().min(1), z.date()]).pipe(z.coerce.date())

export const commercialLineSchema = z.object({
  product_id: objectIdSchema,
  variant_id: optionalObjectIdSchema,
  unit_id: optionalObjectIdSchema,
  quantity: z.number().finite().positive(),
  unit_price: finiteNonNegative,
  discount: finiteNonNegative.default(0),
  discount_method: z.enum(['1', '2']).default('1'),
  tax_method: z.enum(['1', '2']).default('1'),
  tax_percent: percentage.default(0),
})

export const commercialDocumentSchema = z.object({
  date: documentDate,
  warehouse_id: objectIdSchema,
  client_id: optionalObjectIdSchema.optional(),
  provider_id: optionalObjectIdSchema.optional(),
  status: z.string().min(1).max(32),
  notes: z.string().max(4000).default(''),
  discount: finiteNonNegative.default(0),
  shipping: finiteNonNegative.default(0),
  tax_rate: percentage.default(0),
  is_pos: z.boolean().optional().default(false),
  details: z.array(commercialLineSchema).min(1),
})

export type CanonicalCommercialDocument = ReturnType<typeof canonicalCommercialDocument>

export function canonicalCommercialDocument(input: unknown) {
  const parsed = commercialDocumentSchema.parse(input)
  const details = parsed.details.map((line) => {
    const result = calcLine({
      unitPrice: line.unit_price,
      quantity: line.quantity,
      discount: line.discount,
      discountMethod: line.discount_method,
      taxRate: line.tax_percent,
      taxMethod: line.tax_method,
    })
    return {
      ...line,
      tax_net: result.taxAmount,
      Net_price: result.net,
      subtotal: result.subtotal,
    }
  })
  const totals = calcGrandTotal({
    lineSubtotals: details.map((line) => line.subtotal),
    orderDiscount: parsed.discount,
    orderTaxRate: parsed.tax_rate,
    shipping: parsed.shipping,
  })
  return {
    ...parsed,
    details,
    TaxNet: totals.taxNet,
    GrandTotal: totals.grandTotal,
  }
}

export const adjustmentSchema = z.object({
  date: documentDate,
  warehouse_id: objectIdSchema,
  notes: z.string().max(4000).default(''),
  details: z.array(z.object({
    product_id: objectIdSchema,
    variant_id: optionalObjectIdSchema,
    quantity: z.number().finite().positive(),
    type: z.enum(['add', 'sub']),
    cost: finiteNonNegative.default(0),
  })).min(1),
})

export function canonicalAdjustment(input: unknown) {
  const parsed = adjustmentSchema.parse(input)
  return {
    ...parsed,
    details: parsed.details.map((detail) => ({
      ...detail,
      subtotal: round2(detail.quantity * detail.cost),
    })),
  }
}

export const transferSchema = z.object({
  date: documentDate,
  from_warehouse_id: objectIdSchema,
  to_warehouse_id: objectIdSchema,
  status: z.enum(['pending', 'sent', 'completed']),
  notes: z.string().max(4000).default(''),
  shipping: finiteNonNegative.default(0),
  details: z.array(z.object({
    product_id: objectIdSchema,
    variant_id: optionalObjectIdSchema,
    unit_id: optionalObjectIdSchema,
    quantity: z.number().finite().positive(),
    Net_price: finiteNonNegative.default(0),
  })).min(1),
}).superRefine((value, ctx) => {
  if (value.from_warehouse_id === value.to_warehouse_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to_warehouse_id'], message: 'Warehouses must be different' })
  }
})

export function canonicalTransfer(input: unknown) {
  const parsed = transferSchema.parse(input)
  const details = parsed.details.map((detail) => ({
    ...detail,
    subtotal: round2(detail.quantity * detail.Net_price),
  }))
  return {
    ...parsed,
    details,
    GrandTotal: round2(details.reduce((sum, detail) => sum + detail.subtotal, 0) + parsed.shipping),
  }
}

export const paymentSchema = z.object({
  parent_id: objectIdSchema.optional(),
  sale_id: objectIdSchema.optional(),
  purchase_id: objectIdSchema.optional(),
  sale_return_id: objectIdSchema.optional(),
  purchase_return_id: objectIdSchema.optional(),
  date: documentDate,
  montant: z.number().finite().min(0.01).max(Number.MAX_SAFE_INTEGER / 10000),
  change: finiteNonNegative.default(0),
  payment_method: z.string().trim().min(1).max(64).default('cash'),
  notes: z.string().max(4000).default(''),
})

export const productSchema = z.object({
  code: z.string().trim().max(128).optional().default(''),
  name: z.string().trim().min(1).max(255),
  barcode_symbology: z.enum(['CODE128', 'CODE39', 'UPCA', 'EAN13']).default('CODE128'),
  category_id: optionalObjectIdSchema,
  brand_id: optionalObjectIdSchema,
  unit_id: optionalObjectIdSchema,
  sale_unit_id: optionalObjectIdSchema,
  purchase_unit_id: optionalObjectIdSchema,
  cost: finiteNonNegative,
  price: finiteNonNegative,
  tax_method: z.enum(['1', '2']).default('1'),
  TaxNet: percentage.default(0),
  note: z.string().max(4000).default(''),
  image: z.string().max(500).optional().default('no-image.png'),
  images: z.array(z.string().max(500)).max(20).optional().default([]),
  is_variant: z.boolean().default(false),
  has_alert: z.boolean().default(false),
  alert_quantity: finiteNonNegative.default(0),
  variants: z.array(z.object({
    _id: objectIdSchema.optional(),
    name: z.string().trim().min(1).max(255),
    code: z.string().trim().min(1).max(128),
  })).max(100).default([]),
}).superRefine((value, ctx) => {
  if (!value.unit_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit_id'], message: 'Base unit is required' })
  }
  if (value.is_variant && value.variants.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'At least one variant is required' })
  }
  if (!value.is_variant && value.variants.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Non-variant products cannot contain variants' })
  }
  if (value.is_variant) {
    const codes = value.variants.map((v) => v.code.trim())
    const names = value.variants.map((v) => v.name.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Variant barcodes must be unique' })
    }
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Variant names must be unique' })
    }
    if (value.code && codes.includes(value.code.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Variant code cannot be the same as the product code' })
    }
  }
})

export const categorySchema = z.object({
  code: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(255),
})

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(1000).default(''),
  image: z.string().max(500).default(''),
})

export const currencySchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()),
  symbol: z.string().trim().min(1).max(16),
})

export const unitSchema = z.object({
  name: z.string().trim().min(1).max(255),
  short_name: z.string().trim().min(1).max(64),
  base_unit: optionalObjectIdSchema,
  operator: z.enum(['*', '/']).default('*'),
  operator_value: z.number().finite().positive().default(1),
}).superRefine((value, ctx) => {
  if (!value.base_unit && (value.operator !== '*' || value.operator_value !== 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['operator_value'], message: 'A base unit must use * 1' })
  }
})

export const warehouseSchema = z.object({
  name: z.string().trim().min(1).max(255),
  city: z.string().max(255).default(''),
  country: z.string().max(255).default(''),
  email: z.union([z.string().email(), z.literal('')]).default(''),
  phone: z.string().max(64).default(''),
  zip: z.string().max(32).default(''),
})

export const personSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(64).optional().default(''),
  email: z.union([z.string().email(), z.literal('')]).default(''),
  phone: z.string().max(64).default(''),
  country: z.string().max(255).default(''),
  city: z.string().max(255).default(''),
  address: z.string().max(1000).default(''),
  tax_number: z.string().max(128).default(''),
})

export const expenseSchema = z.object({
  date: documentDate,
  warehouse_id: objectIdSchema,
  category_id: objectIdSchema,
  amount: z.number().finite().positive(),
  details: z.string().trim().min(1).max(4000),
})

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(4000).default(''),
})

export const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  phone: z.string().max(64).default(''),
  avatar: z.string().max(500).default('avatar-default.png'),
  statut: z.boolean().default(true),
  roles: z.array(objectIdSchema).min(1),
})

export const userUpdateSchema = userCreateSchema.omit({ password: true }).extend({
  password: z.union([z.string().min(8).max(200), z.literal('')]).optional(),
})

export const roleSchema = z.object({
  name: z.string().trim().min(1).max(255),
  statut: z.boolean().default(true),
  permissions: z.array(objectIdSchema),
})

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().email(),
  phone: z.string().max(64).default(''),
  avatar: z.string().max(500).default('avatar-default.png'),
  current_password: z.string().optional(),
  password: z.union([z.string().min(8).max(200), z.literal('')]).optional(),
})

export const settingSchema = z.object({
  CompanyName: z.string().trim().min(1).max(255),
  CompanyPhone: z.string().max(64).default(''),
  CompanyAdress: z.string().max(1000).default(''),
  email: z.union([z.string().email(), z.literal('')]).default(''),
  logo: z.string().max(500).default('logo-default.png'),
  footer: z.string().max(1000).default(''),
  developed_by: z.string().max(255).default(''),
  currency_id: optionalObjectIdSchema,
  client_id: optionalObjectIdSchema,
  warehouse_id: optionalObjectIdSchema,
  default_language: z.string().trim().min(2).max(16).default('en'),
})

export const posSettingSchema = z.object({
  note_customer: z.string().max(2000).default('Thank You For Shopping With Us. Please Come Again.'),
  show_note: z.boolean().default(true),
  show_barcode: z.boolean().default(true),
  show_discount: z.boolean().default(true),
  show_customer: z.boolean().default(true),
  show_email: z.boolean().default(true),
  show_phone: z.boolean().default(true),
  show_address: z.boolean().default(true),
})

export const smtpSchema = z.object({
  name: z.string().max(255).default('default'),
  smtp_host: z.string().trim().min(1).max(255),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  encryption: z.enum(['tls', 'ssl', 'none']).default('tls'),
  smtp_username: z.string().max(255).default(''),
  smtp_password: z.string().max(500).optional(),
  smtp_email: z.union([z.string().email(), z.literal('')]).default(''),
})

export const paymentGatewaySchema = z.object({
  provider: z.literal('stripe').default('stripe'),
  enabled: z.boolean().default(false),
  public_key: z.string().max(500).default(''),
  secret_key: z.string().max(500).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default('USD'),
})

export const smsSettingSchema = z.object({
  provider: z.literal('twilio').default('twilio'),
  enabled: z.boolean().default(false),
  account_sid: z.string().max(500).default(''),
  auth_token: z.string().max(500).optional(),
  from_number: z.string().max(64).default(''),
})

