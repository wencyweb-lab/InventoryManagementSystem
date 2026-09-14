import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import mongoose from 'mongoose'
import { ApiError, requirePermission, requireSession, withErrorHandler } from '@/lib/permissions'

/**
 * POST /api/admin/clear-cache
 * Clears Mongoose's model registry and internal connection-level caches.
 * Forces fresh model/schema compilation on the next request.
 * Mirrors the legacy GET /api/Clear_Cache endpoint.
 */
export const POST = withErrorHandler(async () => {
  const user = await requireSession()
  await requirePermission(user, 'setting_system')
  await dbConnect()

  // Clear Mongoose's compiled model cache — next request re-registers models
  const modelCount = Object.keys(mongoose.models).length
  Object.keys(mongoose.models).forEach((modelName) => {
    delete mongoose.models[modelName]
    delete (mongoose as any).modelSchemas?.[modelName]
  })

  // Report cache clear
  const clearedAt = new Date().toISOString()
  return NextResponse.json({
    message: 'Cache cleared successfully',
    clearedAt,
    modelsCleared: Object.keys(mongoose.models).length,
  })
})

/**
 * GET /api/admin/clear-cache
 * Returns basic system diagnostics without clearing.
 */
export const GET = withErrorHandler(async () => {
  const user = await requireSession()
  await requirePermission(user, 'setting_system')
  await dbConnect()

  const db = mongoose.connection
  return NextResponse.json({
    status: 'ok',
    dbState: ['disconnected', 'connected', 'connecting', 'disconnecting'][db.readyState] ?? 'unknown',
    dbName: db.name,
    models: Object.keys(mongoose.models),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  })
})
