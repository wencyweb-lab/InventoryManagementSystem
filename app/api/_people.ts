import { parseBulkIds } from '@/lib/bulk'
import { guardResourceDeletion } from '@/lib/resource-integrity'
import { NextResponse } from 'next/server'
import type { Model } from 'mongoose'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { personSchema } from '@/lib/validation'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { nextNumericCode } from '@/lib/references'

export function peopleCollection(Model: Model<any>, type: 'client' | 'provider', view: string, add: string, remove?: string) {
  return {
    GET: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, view)
      await dbConnect()
      const url = new URL(req.url)
      const { page, limit, skip, search } = parsePagination(url)
      const filter: any = { deletedAt: null }
      if (search) { const pattern = escapeRegex(search); filter.$or = [{ name: { $regex: pattern, $options: 'i' } }, { email: { $regex: pattern, $options: 'i' } }, { phone: { $regex: pattern, $options: 'i' } }, { code: { $regex: pattern, $options: 'i' } }] }
      if (url.searchParams.get('all') === 'true' || url.searchParams.get('unpaginated') === 'true') {
        return NextResponse.json(await Model.find(filter).select('name email phone code').sort({ name: 1 }).lean())
      }
      const [data, total] = await Promise.all([
        Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Model.countDocuments(filter),
      ])
      return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
    }),
    POST: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, add)
      await dbConnect()
      const body = personSchema.parse(await req.json())
      let code = body.code?.trim()
      if (code) {
        const exists = await Model.findOne({ code, deletedAt: null })
        if (exists) throw new ApiError(409, `Code '${code}' is already in use`)
      } else {
        do {
          code = await nextNumericCode(type)
        } while (await Model.findOne({ code, deletedAt: null }))
      }
      return NextResponse.json(await Model.create({ ...body, code }), { status: 201 })
    }),
    DELETE: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      if (remove) await requirePermission(user, remove)
      await dbConnect()
      const ids = await parseBulkIds(req)
      await guardResourceDeletion(Model.modelName, ids)
      await Model.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } })
      return NextResponse.json({ message: `${ids.length} records deleted`, count: ids.length })
    }),
  }
}

export function peopleItem(Model: Model<any>, label: string, view: string, edit: string, remove: string) {
  return {
    GET: withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, view)
      await dbConnect()
      const document = await Model.findOne({ _id: ctx.params.id, deletedAt: null })
      if (!document) throw new ApiError(404, `${label} not found`)
      return NextResponse.json(document)
    }),
    PUT: withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, edit)
      await dbConnect()
      const body = personSchema.parse(await req.json())
      const updateData: any = { ...body }
      const incomingCode = body.code?.trim()
      if (!incomingCode) {
        delete updateData.code
      } else {
        const exists = await Model.findOne({ code: incomingCode, _id: { $ne: ctx.params.id }, deletedAt: null })
        if (exists) throw new ApiError(409, `Code '${incomingCode}' is already in use`)
        updateData.code = incomingCode
      }
      const document = await Model.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, updateData, { new: true, runValidators: true })
      if (!document) throw new ApiError(404, `${label} not found`)
      return NextResponse.json(document)
    }),
    DELETE: withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, remove)
      await dbConnect()
      await guardResourceDeletion(Model.modelName, [ctx.params.id])
      const document = await Model.findOneAndUpdate({ _id: ctx.params.id, deletedAt: null }, { deletedAt: new Date() }, { new: true })
      if (!document) throw new ApiError(404, `${label} not found`)
      return NextResponse.json({ message: `${label} deleted` })
    }),
  }
}

