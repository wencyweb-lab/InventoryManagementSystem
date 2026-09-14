// ============================================================
// UNIT CONVERSION — preserves base-unit invariant from legacy
// ============================================================

export type UnitOperator = '*' | '/'
export class CalculationError extends Error {}

export interface UnitInfo {
  operator: UnitOperator
  operator_value: number
}

/**
 * Convert a transaction quantity to BASE units for storage in product_warehouse.
 * Legacy formula: if operator '/' → base = qty / value; else → base = qty * value
 */
export function toBaseQty(transactionQty: number, unit: UnitInfo): number {
  if (!Number.isFinite(transactionQty) || transactionQty < 0) {
    throw new CalculationError('Quantity must be a finite non-negative number')
  }
  if (!Number.isFinite(unit.operator_value) || unit.operator_value <= 0) {
    throw new CalculationError('Unit conversion value must be greater than zero')
  }
  if (unit.operator === '/') {
    return transactionQty / unit.operator_value
  }
  return transactionQty * unit.operator_value
}

/**
 * Convert BASE unit quantity to display unit (for showing stock in sale/purchase unit).
 * Legacy formula (inverse): if operator '/' → display = base * value; else → display = base / value
 */
export function fromBaseQty(baseQty: number, unit: UnitInfo): number {
  if (!Number.isFinite(baseQty)) {
    throw new CalculationError('Base quantity must be finite')
  }
  if (!Number.isFinite(unit.operator_value) || unit.operator_value <= 0) {
    throw new CalculationError('Unit conversion value must be greater than zero')
  }
  if (unit.operator === '/') {
    return baseQty * unit.operator_value
  }
  return baseQty / unit.operator_value
}

// ============================================================
// LINE ITEM CALCULATIONS — mirrors Vue calculation logic
// ============================================================

export type DiscountMethod = '1' | '2' // '1' = percentage, '2' = fixed
export type TaxMethod = '1' | '2' // '1' = exclusive, '2' = inclusive

export interface LineCalcInput {
  unitPrice: number
  quantity: number
  discount: number
  discountMethod: DiscountMethod
  taxRate: number
  taxMethod: TaxMethod
}

export interface LineCalcResult {
  discountNet: number
  net: number
  taxAmount: number
  subtotal: number
}

export function calcLine(input: LineCalcInput): LineCalcResult {
  const { unitPrice, quantity, discount, discountMethod, taxRate, taxMethod } = input

  if (![unitPrice, quantity, discount, taxRate].every(Number.isFinite)) {
    throw new CalculationError('Line values must be finite numbers')
  }
  if (unitPrice < 0 || quantity <= 0 || discount < 0 || taxRate < 0) {
    throw new CalculationError('Line values cannot be negative and quantity must be greater than zero')
  }

  // Discount
  const discountNet =
    discountMethod === '2' ? discount : (unitPrice * discount) / 100

  let net: number
  let taxAmount: number

  if (taxMethod === '1') {
    // Exclusive tax
    net = unitPrice - discountNet
    taxAmount = (taxRate * (unitPrice - discountNet)) / 100
  } else {
    // Inclusive tax
    net = (unitPrice - discountNet) / (1 + taxRate / 100)
    taxAmount = unitPrice - net - discountNet
  }

  if (discountNet > unitPrice) {
    throw new CalculationError('Line discount cannot exceed the unit price')
  }

  const subtotal = quantity * net + quantity * taxAmount

  return {
    discountNet: round4(discountNet),
    net: round4(net),
    taxAmount: round4(taxAmount),
    subtotal: round4(subtotal),
  }
}

// ============================================================
// HEADER / GRAND TOTAL
// ============================================================

export interface HeaderCalcInput {
  lineSubtotals: number[]
  orderDiscount: number
  orderTaxRate: number
  shipping: number
}

export interface HeaderCalcResult {
  detailTotal: number
  taxableBase: number
  taxNet: number
  grandTotal: number
}

export function calcGrandTotal(input: HeaderCalcInput): HeaderCalcResult {
  const { lineSubtotals, orderDiscount, orderTaxRate, shipping } = input
  if (![...lineSubtotals, orderDiscount, orderTaxRate, shipping].every(Number.isFinite)) {
    throw new CalculationError('Header values must be finite numbers')
  }
  if (lineSubtotals.some((value) => value < 0) || orderDiscount < 0 || orderTaxRate < 0 || shipping < 0) {
    throw new CalculationError('Header values cannot be negative')
  }
  const detailTotal = lineSubtotals.reduce((sum, v) => sum + v, 0)
  if (orderDiscount > detailTotal) {
    throw new CalculationError('Order discount cannot exceed the detail total')
  }
  const taxableBase = detailTotal - orderDiscount
  const taxNet = (taxableBase * orderTaxRate) / 100
  const grandTotal = taxableBase + taxNet + shipping
  return {
    detailTotal: round4(detailTotal),
    taxableBase: round4(taxableBase),
    taxNet: round4(taxNet),
    grandTotal: round2(grandTotal),
  }
}

// ============================================================
// PAYMENT STATUS DERIVATION
// ============================================================

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export function calcPaymentStatus(paidAmount: number, grandTotal: number): PaymentStatus {
  const normalizedPaid = round2(Math.max(0, paidAmount))
  const due = round2(grandTotal - normalizedPaid)
  if (due <= 0.005) return 'paid'
  if (normalizedPaid > 0) return 'partial'
  return 'unpaid'
}

// ============================================================
// REFERENCE GENERATION
// ============================================================

const REF_PREFIXES = {
  sale: 'SL',
  purchase: 'PR',
  quotation: 'QT',
  saleReturn: 'RT',
  purchaseReturn: 'RT',
  transfer: 'TR',
  adjustment: 'AD',
  expense: 'EXP',
  paymentSale: 'INV/SL',
  paymentPurchase: 'INV/PR',
  paymentSaleReturn: 'INV/RT',
  paymentPurchaseReturn: 'INV/RT',
} as const

export type RefType = keyof typeof REF_PREFIXES

export function generateNextRef(type: RefType, latestRef: string | null | undefined): string {
  const prefix = REF_PREFIXES[type]
  const initialNum = 1111

  if (!latestRef) return `${prefix}_${initialNum}`

  // Extract numeric suffix after the last underscore
  const parts = latestRef.split('_')
  const lastPart = parts[parts.length - 1]
  const num = parseInt(lastPart, 10)

  if (isNaN(num)) return `${prefix}_${initialNum}`

  return `${prefix}_${num + 1}`
}

// ============================================================
// STOCK MUTATION HELPERS
// ============================================================

/** Determine if a purchase status triggers a stock add. */
export function purchaseAddsStock(status: string): boolean {
  return status === 'received'
}

/** Determine if a sale status triggers a stock subtract. */
export function saleSubtractsStock(status: string): boolean {
  return status === 'completed'
}

/** Determine if a sale return status triggers a stock add. */
export function saleReturnAddsStock(status: string): boolean {
  return status === 'received'
}

/** Determine if a purchase return status triggers a stock subtract. */
export function purchaseReturnSubtractsStock(status: string): boolean {
  return status === 'completed'
}

/** Transfer stock effects by status. */
export function transferEffect(status: string): { removeSource: boolean; addDest: boolean } {
  if (status === 'completed') return { removeSource: true, addDest: true }
  if (status === 'sent') return { removeSource: true, addDest: false }
  return { removeSource: false, addDest: false }
}

// ============================================================
// UTILITY
// ============================================================

export function round2(n: number): number {
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER / 100) throw new CalculationError('Amount is outside the supported range')
  return parseFloat(n.toFixed(2))
}

export function round4(n: number): number {
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER / 10000) throw new CalculationError('Quantity or amount is outside the supported range')
  return parseFloat(n.toFixed(4))
}

export function generateCode(latest: number | null): string {
  return String((latest ?? 0) + 1).padStart(6, '0')
}

