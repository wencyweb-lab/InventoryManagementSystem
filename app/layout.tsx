import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Noto_Serif_Georgian } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import SessionProvider from '@/components/providers/SessionProvider'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fontSerif = Noto_Serif_Georgian({
  subsets: ['latin'],
  variable: '--font-serif',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: { default: 'Stocky', template: '%s | Stocky' },
  description: 'Complete Inventory Management System with POS, Sales, Purchases, and Reporting',
  icons: { icon: '/favicon.ico' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} min-h-screen font-sans antialiased`}>
        <SessionProvider session={session}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--popover)',
                color: 'var(--popover-foreground)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                boxShadow: '0 10px 30px rgba(0,0,0,.12)',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
