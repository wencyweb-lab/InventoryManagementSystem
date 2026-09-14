import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

const contentTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

// New public files are not discovered by an already running production server.
// Serve only the image folders used by the upload API, including newly saved files.
export async function GET(_request: Request, context: { params: Promise<{ kind: string; name: string }> }) {
  const { kind, name } = await context.params
  const mime = contentTypes[path.extname(name).toLowerCase()]
  if (!['products', 'logos', 'avatars'].includes(kind) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(name) || !mime) {
    return new NextResponse(null, { status: 404 })
  }
  const root = path.resolve(process.cwd(), 'public', 'uploads', kind)
  const file = path.resolve(root, name)
  if (!file.startsWith(root + path.sep)) return new NextResponse(null, { status: 404 })
  try {
    const bytes = await readFile(file)
    return new NextResponse(bytes, { headers: { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600' } })
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return new NextResponse(null, { status: 404 })
    return new NextResponse(null, { status: 500 })
  }
}
