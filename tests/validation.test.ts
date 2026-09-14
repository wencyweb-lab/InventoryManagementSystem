import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalCommercialDocument, canonicalTransfer } from '../lib/validation'

const id = '507f1f77bcf86cd799439011'

test('server canonicalization ignores forged browser totals', () => {
  const value = canonicalCommercialDocument({
    date: '2026-07-28',
    warehouse_id: id,
    client_id: id,
    status: 'completed',
    discount: 0,
    shipping: 0,
    tax_rate: 0,
    GrandTotal: 0.01,
    TaxNet: 999999,
    details: [{
      product_id: id,
      quantity: 2,
      unit_price: 25,
      discount: 0,
      discount_method: '1',
      tax_method: '1',
      tax_percent: 0,
      subtotal: 0.01,
      Net_price: 0.01,
    }],
  })
  assert.equal(value.details[0].subtotal, 50)
  assert.equal(value.GrandTotal, 50)
  assert.equal(value.TaxNet, 0)
})

test('negative or zero commercial quantities are rejected', () => {
  assert.throws(() => canonicalCommercialDocument({
    date: new Date(), warehouse_id: id, status: 'pending', discount: 0, shipping: 0, tax_rate: 0,
    details: [{ product_id: id, quantity: 0, unit_price: 1, discount: 0, discount_method: '1', tax_method: '1', tax_percent: 0 }],
  }))
})

test('a transfer cannot use the same source and destination', () => {
  assert.throws(() => canonicalTransfer({
    date: new Date(), from_warehouse_id: id, to_warehouse_id: id, status: 'pending', shipping: 0,
    details: [{ product_id: id, quantity: 1, Net_price: 0 }],
  }), /Warehouses must be different/)
})

test('product variant codes must be unique and cannot collide with product code', async () => {
  const { productSchema } = await import('../lib/validation')
  // Duplicate variant codes
  assert.throws(() => productSchema.parse({
    name: 'T-Shirt',
    code: 'TSHIRT-001',
    unit_id: id,
    cost: 10,
    price: 20,
    is_variant: true,
    variants: [
      { name: 'Red Small', code: 'VAR-1' },
      { name: 'Blue Large', code: 'VAR-1' },
    ],
  }), /Variant barcodes must be unique/)

  // Variant code matches product code
  assert.throws(() => productSchema.parse({
    name: 'T-Shirt',
    code: 'TSHIRT-001',
    unit_id: id,
    cost: 10,
    price: 20,
    is_variant: true,
    variants: [
      { name: 'Red Small', code: 'TSHIRT-001' },
    ],
  }), /Variant code cannot be the same as the product code/)

  // Duplicate variant names
  assert.throws(() => productSchema.parse({
    name: 'T-Shirt',
    code: 'TSHIRT-001',
    unit_id: id,
    cost: 10,
    price: 20,
    is_variant: true,
    variants: [
      { name: 'Red', code: 'VAR-1' },
      { name: 'Red', code: 'VAR-2' },
    ],
  }), /Variant names must be unique/)
})
