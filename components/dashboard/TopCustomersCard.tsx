import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function TopCustomersCard({ customers }: { customers: { name: string; total: number; count: number }[] }) {
  const maximum = Math.max(...customers.map((customer) => customer.total), 1);
  return (
    <Card className="justify-between gap-5">
      <CardHeader className="flex-row items-start justify-between"><div><p className="text-lg font-semibold">Top customers</p><p className="mt-1 text-sm text-muted-foreground">Highest spend this month</p></div><Link href="/dashboard/reports/customers" className="table-action-btn"><ArrowUpRight className="h-4 w-4" /></Link></CardHeader>
      <CardContent className="space-y-5">
        {customers.length ? customers.slice(0, 5).map((customer, index) => (
          <div key={`${customer.name}-${index}`} className="space-y-2"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.count} orders</p></div><span className="text-sm font-medium">{formatCurrency(customer.total)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (customer.total / maximum) * 100)}%` }} /></div></div>
        )) : <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">No customer activity this month</div>}
      </CardContent>
    </Card>
  );
}
