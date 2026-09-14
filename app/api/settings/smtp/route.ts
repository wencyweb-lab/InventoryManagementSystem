import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { Server } from '@/models/Settings'
import { smtpSchema } from '@/lib/validation'
import { encryptSecret } from '@/lib/secrets'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async () => {
  const user = await requireSession()
  await requirePermission(user, 'setting_system')
  await dbConnect()
  const server: any = await Server.findOne().select('+smtp_password').lean()
  if (!server) return NextResponse.json({})
  const passwordConfigured = Boolean(server.smtp_password)
  delete server.smtp_password
  return NextResponse.json({ ...server, password_configured: passwordConfigured })
})

export const PUT = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await requirePermission(user, 'setting_system')
  await dbConnect()
  const body = smtpSchema.parse(await req.json())
  const update: Record<string, unknown> = { ...body }
  if (!body.smtp_password) delete update.smtp_password
  else update.smtp_password = encryptSecret(body.smtp_password)
  const server = await Server.findOneAndUpdate({}, update, { new: true, upsert: true, runValidators: true }).select('+smtp_password')
  return NextResponse.json({
    name: server.name,
    smtp_host: server.smtp_host,
    smtp_port: server.smtp_port,
    encryption: server.encryption,
    smtp_username: server.smtp_username,
    smtp_email: server.smtp_email,
    password_configured: Boolean(server.smtp_password),
  })
})

export const POST = PUT

