import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toFixed(2)}`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Build a query string from an object, skipping empty values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
  }
  return qs.toString() ? `?${qs.toString()}` : ''
}

/** Parse pagination params from URL search params. */
export function parsePagination(url: URL) {
  const rawPage = Number.parseInt(url.searchParams.get('page') || '1', 10)
  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '15', 10)
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 15
  const search = (url.searchParams.get('search') || '').trim().slice(0, 100)
  const sortBy = url.searchParams.get('sortBy') || 'createdAt'
  const sortDir = url.searchParams.get('sortDir') === 'asc' ? 1 : -1
  return { page, limit, skip: (page - 1) * limit, search, sortBy, sortDir }
}

/** Treat user search text literally when building MongoDB regular expressions. */
export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Convert a file to base64 string. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}
