import { parseBulkIds } from '@/lib/bulk'
import { NextResponse } from 'next/server'
import type { Model } from 'mongoose'
import type { ZodType } from 'zod'
import dbConnect from '@/lib/db'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'
import { escapeRegex, parsePagination } from '@/lib/utils'
import { guardResourceDeletion, validateUnit } from '@/lib/resource-integrity'
import { objectIdSchema } from '@/lib/validation'

type Options = {
  model: Model<any>
  permission: string
  schema: ZodType
  label: string
  select?: string
  populate?: string
}

export function simpleCollection(options: Options) {
  const { model: Model, permission, schema, label, select, populate } = options
  return {
    GET: withErrorHandler(async (req: Request) => {
      await requireSession()
      await dbConnect()
      const url = new URL(req.url)
      const { page, limit, skip, search } = parsePagination(url)
      const filter: any = { deletedAt: null }
      if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }
      const baseUnit = url.searchParams.get('base_unit')
      if (baseUnit && /^[a-f\d]{24}$/i.test(baseUnit)) {
        filter.$or = [{ _id: baseUnit }, { base_unit: baseUnit }]
      }
      let query: any = Model.find(filter).sort({ name: 1 })
      if (select) query = query.select(select)
      if (populate) query = query.populate(populate, 'name short_name')
      if (url.searchParams.get('all') === 'true' || url.searchParams.get('unpaginated') === 'true') {
        return NextResponse.json(await query.lean())
      }
      const [data, total] = await Promise.all([query.skip(skip).limit(limit).lean(), Model.countDocuments(filter)])
      return NextResponse.json({ data, total, page, last_page: Math.ceil(total / limit) })
    }),
    POST: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, permission)
      await dbConnect()
      const body: any = schema.parse(await req.json())
      if (body.code) {
        const codeExists = await Model.exists({ code: body.code, deletedAt: null })
        if (codeExists) throw new ApiError(409, `${label} with code '${body.code}' already exists`)
      }
      if (Model.modelName === 'Unit') await validateUnit(body)
      const document = await Model.create(body)
      return NextResponse.json(document, { status: 201 })
    }),
    DELETE: withErrorHandler(async (req: Request) => {
      const user = await requireSession()
      await requirePermission(user, permission)
      await dbConnect()
      const ids = await parseBulkIds(req)

      await guardResourceDeletion(Model.modelName, ids)
      await Model.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: new Date() } })
      return NextResponse.json({ message: `${ids.length} records deleted`, count: ids.length })
    }),
  }
}

export function simpleItem(options: Options) {
  const { model: Model, permission, schema, label, populate } = options
  return {
    GET: withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
      await requireSession()
      await dbConnect()
      let query: any = Model.findOne({ _id: ctx.params.id, deletedAt: null })
      if (populate) query = query.populate(populate, 'name short_name')
      const document = await query
      if (!document) throw new ApiError(404, `${label} not found`)
      return NextResponse.json(document)
    }),
    PUT: withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, permission)
      await dbConnect()
      const body: any = schema.parse(await req.json())
      if (body.code) {
        const codeExists = await Model.exists({ code: body.code, _id: { $ne: ctx.params.id }, deletedAt: null })
        if (codeExists) throw new ApiError(409, `${label} with code '${body.code}' already exists`)
      }
      if (Model.modelName === 'Unit') await validateUnit(body, ctx.params.id)
      const document = await Model.findOneAndUpdate(
        { _id: ctx.params.id, deletedAt: null },
        body,
        { new: true, runValidators: true }
      )
      if (!document) throw new ApiError(404, `${label} not found`)
      return NextResponse.json(document)
    }),
    DELETE: withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
      const user = await requireSession()
      await requirePermission(user, permission)
      await dbConnect()
      await guardResourceDeletion(Model.modelName, [objectIdSchema.parse(ctx.params.id)])
      const document = await Model.findOneAndUpdate(
        { _id: ctx.params.id, deletedAt: null },
        { deletedAt: new Date() },
        { new: true }
      )
      if (!document) throw new ApiError(404, `${label} not found`)
      return NextResponse.json({ message: `${label} deleted` })
    }),
  }
}

