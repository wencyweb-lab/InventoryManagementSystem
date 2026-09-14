import nodemailer from 'nodemailer'
import dbConnect from '@/lib/db'
import { Server } from '@/models/Settings'
import { decryptSecret } from '@/lib/secrets'

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  await dbConnect()
  const server: any = await Server.findOne().select('+smtp_password').lean()
  if (!server?.smtp_host || !server?.smtp_email) {
    return false
  }

  try {
    const password = server.smtp_password ? decryptSecret(server.smtp_password) : undefined
    const transporter = nodemailer.createTransport({
      host: server.smtp_host,
      port: Number(server.smtp_port) || 587,
      secure: server.encryption === 'ssl' || Number(server.smtp_port) === 465,
      requireTLS: server.encryption === 'tls',
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
      auth: server.smtp_username ? {
        user: server.smtp_username,
        pass: password,
      } : undefined,
    })

    await transporter.sendMail({
      from: `"${server.name || 'Stocky'}" <${server.smtp_email}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ''),
      html,
    })

    return true
  } catch (err) {
    console.error('Failed to send email:', err)
    return false
  }
}
