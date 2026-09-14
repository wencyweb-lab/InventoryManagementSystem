import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requireSession, requirePermission, withErrorHandler } from '@/lib/permissions'
import { Setting } from '@/models/Settings'
import '@/models/Currency'
import '@/models/Client'
import '@/models/Warehouse'
import { settingSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async () => {
  await requireSession()
  await dbConnect()
  const settings = await Setting.findOne()
    .populate('currency_id')
    .populate('client_id warehouse_id', 'name')
    .lean()
  return NextResponse.json(settings ?? {})
})

export const PUT = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'setting_system')
  await dbConnect()
  const body = settingSchema.parse(await req.json())
  const settings = await Setting.findOneAndUpdate({}, body, { new: true, upsert: true, runValidators: true })
  return NextResponse.json(settings)
})
