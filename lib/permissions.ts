import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import mongoose from 'mongoose'
import { CalculationError } from '@/lib/calculations'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import '@/models/Role'
import '@/models/Permission'

export type SessionUser = {
  id: string
  name: string
  email: string
  permissions: string[]
  roles: string[]
  avatar?: string
  sessionVersion?: number
}

/** Get current session user. Throws 401 if not authenticated. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as SessionUser | undefined
  if (!sessionUser?.id) {
    throw new ApiError(401, 'Not authenticated')
  }

  await dbConnect()
  const currentUser: any = await User.findOne({
    _id: sessionUser.id,
    statut: true,
    deletedAt: null,
  })
    .populate({ path: 'roles', match: { statut: true, deletedAt: null }, populate: { path: 'permissions' } })
    .lean()

  if (!currentUser) throw new ApiError(401, 'Account is inactive or no longer exists')
  if ((currentUser.sessionVersion ?? 0) !== (sessionUser.sessionVersion ?? 0)) {
    throw new ApiError(401, 'Your password changed. Please sign in again.')
  }

  const permissions = new Set<string>()
  const roles: string[] = []
  for (const role of currentUser.roles ?? []) {
    roles.push(role.name)
    for (const permission of role.permissions ?? []) permissions.add(permission.name)
  }

  return {
    id: currentUser._id.toString(),
    name: currentUser.name,
    email: currentUser.email,
    avatar: currentUser.avatar,
    roles,
    permissions: [...permissions],
  }
}

/** Check if user has ALL of the given permissions. */
export function hasPermission(user: SessionUser, ...perms: string[]): boolean {
  return perms.every((p) => user.permissions.includes(p))
}

/** Throw 403 if missing any of the given permissions. */
export async function requirePermission(user: SessionUser, ...perms: string[]) {
  if (!hasPermission(user, ...perms)) {
    throw new ApiError(403, 'Forbidden: insufficient permissions')
  }
}

/** Check if user can view all records (has record_view permission). */
export function canViewAllRecords(user: SessionUser): boolean {
  return user.permissions.includes('record_view')
}

/** Build record-scope filter: all records if record_view, else only own. */
export function recordScopeFilter(user: SessionUser): Record<string, string> {
  if (canViewAllRecords(user)) return {}
  return { user_id: user.id }
}

/** Mongoose aggregate pipelines do not cast strings to ObjectIds. */
export function recordScopeMatch(user: SessionUser): Record<string, mongoose.Types.ObjectId> {
  if (canViewAllRecords(user)) return {}
  return { user_id: new mongoose.Types.ObjectId(user.id) }
}

export function scopedFilter<T extends Record<string, unknown>>(user: SessionUser, filter: T): T & Record<string, string> {
  return { ...filter, ...recordScopeFilter(user) }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Wrap an API route handler to standardize error responses. */
export function withErrorHandler(
  handler: (req: Request, ctx: any) => Promise<Response>
) {
  return async (req: Request, ctx: any) => {
    try {
      // Resolve Next.js 16 asynchronous parameters before invoking route factories.
      return await handler(req, { ...ctx, params: await ctx?.params })
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ message: err.message }, { status: err.status })
      }
      if (err instanceof CalculationError) {
        return NextResponse.json({ message: err.message }, { status: 422 })
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { message: 'Validation failed', issues: err.flatten() },
          { status: 422 }
        )
      }
      if (err instanceof mongoose.Error.CastError) {
        return NextResponse.json({ message: 'Invalid identifier' }, { status: 400 })
      }
      if (err instanceof SyntaxError) {
        return NextResponse.json({ message: 'Invalid JSON request body' }, { status: 400 })
      }
      if (err instanceof mongoose.Error.ValidationError) {
        return NextResponse.json({ message: 'Validation failed' }, { status: 422 })
      }
      if ((err as any)?.hasErrorLabel?.('TransientTransactionError')) {
        return NextResponse.json({ message: 'A concurrent update occurred. Refresh and retry.' }, { status: 409 })
      }
      if ((err as any)?.code === 11000) {
        return NextResponse.json({ message: 'A unique value is already in use' }, { status: 409 })
      }
      console.error(err)
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
  }
}
