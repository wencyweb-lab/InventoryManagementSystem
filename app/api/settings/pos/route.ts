import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { PosSetting } from '@/models/Settings'
import { posSettingSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async () => {
  await requireSession()
  await dbConnect()
  return NextResponse.json(await PosSetting.findOne().lean() ?? {})
})

export const PUT = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'setting_system')
  await dbConnect()
  const settings = await PosSetting.findOneAndUpdate({}, posSettingSchema.parse(await req.json()), { new: true, upsert: true, runValidators: true })
  return NextResponse.json(settings)
})

export const POST = PUT

