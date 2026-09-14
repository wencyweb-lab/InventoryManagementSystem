import { z } from 'zod'
import { objectIdSchema } from '@/lib/validation'

const idsSchema = z.array(objectIdSchema).min(1).max(500).transform(ids => [...new Set(ids)])

export async function parseBulkIds(request: Request): Promise<string[]> {
  const text = await request.text()
  if (text.trim()) return idsSchema.parse(JSON.parse(text)?.ids)
  return idsSchema.parse(new URL(request.url).searchParams.get('ids')?.split(','))
}
