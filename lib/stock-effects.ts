import type { ClientSession } from 'mongoose'
import { applyLines, baseQuantity, changeStock, validateDocumentReferences } from '@/lib/inventory'
import {
  purchaseAddsStock,
  saleSubtractsStock,
  saleReturnAddsStock,
  purchaseReturnSubtractsStock,
  transferEffect,
  round4,
} from '@/lib/calculations'

type Direction = 'apply' | 'reverse'

const directionMultiplier = (direction: Direction) => direction === 'apply' ? 1 : -1

export async function applyPurchaseEffect(document: any, direction: Direction, session: ClientSession) {
  if (direction === 'apply') await validateDocumentReferences(document, session)
  if (!purchaseAddsStock(document.status)) return
  await applyLines(document.details, document.warehouse_id, directionMultiplier(direction) as 1 | -1, session)
}

export async function applySaleEffect(document: any, direction: Direction, session: ClientSession) {
  if (direction === 'apply') await validateDocumentReferences(document, session)
  if (!saleSubtractsStock(document.status)) return
  await applyLines(document.details, document.warehouse_id, -directionMultiplier(direction) as 1 | -1, session)
}

export async function applyReturnEffect(
  document: any,
  type: 'sale' | 'purchase',
  direction: Direction,
  session: ClientSession
) {
  if (direction === 'apply') await validateDocumentReferences(document, session)
  const active = type === 'sale'
    ? saleReturnAddsStock(document.status)
    : purchaseReturnSubtractsStock(document.status)
  if (!active) return
  const operationSign = type === 'sale' ? 1 : -1
  await applyLines(
    document.details,
    document.warehouse_id,
    (operationSign * directionMultiplier(direction)) as 1 | -1,
    session
  )
}

export async function applyTransferEffect(document: any, direction: Direction, session: ClientSession) {
  if (direction === 'apply') await validateDocumentReferences(document, session)
  const effect = transferEffect(document.status)
  const multiplier = directionMultiplier(direction)
  for (const line of document.details) {
    const quantity = await baseQuantity(line, session)
    if (effect.removeSource) {
      await changeStock(line, document.from_warehouse_id, -quantity * multiplier, session)
    }
    if (effect.addDest) {
      await changeStock(line, document.to_warehouse_id, quantity * multiplier, session)
    }
  }
}

export async function applyAdjustmentEffect(document: any, direction: Direction, session: ClientSession) {
  if (direction === 'apply') await validateDocumentReferences(document, session)
  const multiplier = directionMultiplier(direction)
  for (const line of document.details) {
    // Calling baseQuantity validates product/variant identity. Adjustments are
    // deliberately entered directly in the base unit.
    const quantity = await baseQuantity({ product_id: line.product_id, variant_id: line.variant_id, quantity: line.quantity, unit_id: null }, session)
    const operationSign = line.type === 'add' ? 1 : -1
    await changeStock(line, document.warehouse_id, operationSign * quantity * multiplier, session)
  }
}

type DocumentKind = 'sale' | 'purchase' | 'sale-return' | 'purchase-return' | 'transfer' | 'adjustment'

/** Apply the net edit, so unchanged receipts can be edited after some stock was sold. */
export async function reconcileStockEffects(previous: any, next: any, kind: DocumentKind, session: ClientSession) {
  await validateDocumentReferences(next, session)
  const deltas = new Map<string, { line: any; warehouse: any; delta: number }>()
  async function collect(document: any, multiplier: number) {
    for (const detail of document.details) {
      const line = kind === 'adjustment' ? { product_id: detail.product_id, variant_id: detail.variant_id, quantity: detail.quantity, unit_id: null } : detail
      const quantity = await baseQuantity(line, session)
      const movements: [any, number][] = []
      if (kind === 'transfer') {
        const effect = transferEffect(document.status)
        if (effect.removeSource) movements.push([document.from_warehouse_id, -1])
        if (effect.addDest) movements.push([document.to_warehouse_id, 1])
      } else if (kind === 'adjustment') movements.push([document.warehouse_id, detail.type === 'add' ? 1 : -1])
      else {
        const active = kind === 'sale' ? saleSubtractsStock(document.status) : kind === 'purchase' ? purchaseAddsStock(document.status) : kind === 'sale-return' ? saleReturnAddsStock(document.status) : purchaseReturnSubtractsStock(document.status)
        if (active) movements.push([document.warehouse_id, kind === 'sale' || kind === 'purchase-return' ? -1 : 1])
      }
      for (const [warehouse, sign] of movements) {
        const key = `${line.product_id}:${line.variant_id ?? ''}:${warehouse}`
        const current = deltas.get(key) ?? { line, warehouse, delta: 0 }
        current.delta = round4(current.delta + quantity * sign * multiplier)
        deltas.set(key, current)
      }
    }
  }
  await collect(previous, -1)
  await collect(next, 1)
  for (const { line, warehouse, delta } of deltas.values()) await changeStock(line, warehouse, delta, session)
}
