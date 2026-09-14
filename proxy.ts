import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import type { NextFetchEvent, NextRequest } from 'next/server'

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return withAuth(request as NextRequestWithAuth, event)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/pos/:path*',
    '/products/:path*',
    '/sales/:path*',
    '/purchases/:path*',
    '/quotations/:path*',
    '/transfers/:path*',
    '/adjustments/:path*',
    '/expenses/:path*',
    '/people/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/sale-returns/:path*',
    '/purchase-returns/:path*',
  ],
}
