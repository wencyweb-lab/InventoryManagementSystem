import type { ClientSession, Model } from 'mongoose'
import Counter from '@/models/Counter'
import type { RefType } from '@/lib/calculations'

const PREFIXES: Record<RefType, string> = {
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
}

/**
 * Allocate a reference atomically. The one-time seed from existing documents
 * lets this work when counters are introduced into a populated migration.
 */
export async function nextReference(
  type: RefType,
  sourceModel: Model<any>,
  session?: ClientSession
): Promise<string> {
  const key = `reference:${type}`
  const prefix = PREFIXES[type]
  let aggregation = sourceModel.aggregate([
    { $match: { Ref: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d+$` } } },
    { $project: { sequence: { $convert: { input: { $arrayElemAt: [{ $split: ['$Ref', '_'] }, -1] }, to: 'long', onError: 1110, onNull: 1110 } } } },
    { $group: { _id: null, sequence: { $max: '$sequence' } } },
  ])
  if (session) aggregation = aggregation.session(session)
  const existing = await aggregation.exec()
  const initialSequence = Math.max(1110, Number(existing[0]?.sequence ?? 1110))

  await Counter.updateOne(
    { _id: key },
    { $setOnInsert: { sequence: initialSequence } },
    { upsert: true, session }
  )

  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { sequence: 1 } },
    { new: true, session }
  )

  if (!counter) throw new Error(`Unable to allocate ${type} reference`)
  return `${prefix}_${counter.sequence}`
}

export async function previewNextReference(
  type: RefType,
  sourceModel: Model<any>
): Promise<string> {
  const key = `reference:${type}`
  const prefix = PREFIXES[type]
  const counter = await Counter.findById(key)
  if (counter) {
    return `${prefix}_${counter.sequence + 1}`
  }
  const aggregation = await sourceModel.aggregate([
    { $match: { Ref: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d+$` } } },
    { $project: { sequence: { $convert: { input: { $arrayElemAt: [{ $split: ['$Ref', '_'] }, -1] }, to: 'long', onError: 1110, onNull: 1110 } } } },
    { $group: { _id: null, sequence: { $max: '$sequence' } } },
  ]).exec()
  const initialSequence = Math.max(1110, Number(aggregation[0]?.sequence ?? 1110))
  return `${prefix}_${initialSequence + 1}`
}

export async function nextNumericCode(
  type: 'client' | 'provider' | 'product' | 'category',
  session?: ClientSession
): Promise<string> {
  await Counter.updateOne(
    { _id: `code:${type}` },
    { $setOnInsert: { sequence: 999 } },
    { upsert: true, session }
  )
  const counter = await Counter.findOneAndUpdate(
    { _id: `code:${type}` },
    { $inc: { sequence: 1 } },
    { new: true, session }
  )
  if (!counter) throw new Error(`Unable to allocate ${type} code`)
  return String(counter.sequence).padStart(6, '0')
}
