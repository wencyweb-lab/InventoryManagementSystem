import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface TopProduct {
  name: string
  code: string
  quantity: number
  revenue: number
}

export function TopProductsCard({ products }: { products: TopProduct[] }) {
  const maxQty = Math.max(...products.map((p) => p.quantity), 1)
  return (
    <Card className="justify-between gap-5">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <p className="text-lg font-semibold">Top products</p>
          <p className="mt-1 text-sm text-muted-foreground">Highest sold by quantity this year</p>
        </div>
        <Link href="/dashboard/reports/sales" className="table-action-btn">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        {products.length ? products.slice(0, 5).map((product, index) => (
          <div key={`${product.code}-${index}`} className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {product.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.quantity} units · {formatCurrency(product.revenue)}</p>
              </div>
              <span className="text-sm font-bold text-primary">{product.quantity}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.max(8, (product.quantity / maxQty) * 100)}%` }}
              />
            </div>
          </div>
        )) : (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            No sales data this year
          </div>
        )}
      </CardContent>
    </Card>
  )
}
