import nodemailer from 'nodemailer'
import { ApiError } from '@/lib/permissions'
import { Server } from '@/models/Settings'
import { decryptSecret } from '@/lib/secrets'

export async function sendConfiguredEmail(input: { to: string; subject: string; text: string; html: string }) {
  const server: any = await Server.findOne().select('+smtp_password').lean()
  if (!server?.smtp_host || !server.smtp_password || !(server.smtp_email || server.smtp_username)) {
    throw new ApiError(503, 'SMTP is not fully configured')
  }
  const secure = server.encryption === 'ssl'
  const transport = nodemailer.createTransport({
    host: server.smtp_host,
    port: server.smtp_port,
    secure,
    requireTLS: server.encryption === 'tls',
    auth: server.smtp_username ? { user: server.smtp_username, pass: decryptSecret(server.smtp_password) } : undefined,
  })
  const result = await transport.sendMail({
    from: server.smtp_email || server.smtp_username,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
  return result.messageId
}
