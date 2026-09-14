import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

export function RecentSalesCard({ sales }: { sales: any[] }) {
  return (
    <Card className="col-span-full gap-4">
      <CardHeader className="flex-row items-center justify-between"><div><p className="text-lg font-semibold">Recent sales</p><p className="mt-1 text-sm text-muted-foreground">Latest customer transactions</p></div><Link href="/dashboard/sales" className="button-outline">View all <ArrowUpRight className="h-4 w-4" /></Link></CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <table className="w-full text-sm"><thead><tr className="border-y bg-muted/30 text-left"><th className="h-10 px-6 font-medium">Reference</th><th className="h-10 px-3 font-medium">Customer</th><th className="h-10 px-3 font-medium">Date</th><th className="h-10 px-3 text-right font-medium">Total</th><th className="h-10 px-6 text-right font-medium">Payment</th></tr></thead><tbody>{sales.length ? sales.map((sale) => <tr key={sale._id} className="border-b last:border-0 hover:bg-muted/30"><td className="px-6 py-3"><Link href={`/dashboard/sales/${sale._id}`} className="font-medium hover:underline">{sale.Ref}</Link></td><td className="px-3 py-3 text-muted-foreground">{sale.client_id?.name ?? "Walk-in customer"}</td><td className="px-3 py-3 text-muted-foreground">{formatDate(sale.date)}</td><td className="px-3 py-3 text-right font-medium">{formatCurrency(sale.GrandTotal)}</td><td className="px-6 py-3 text-right"><StatusBadge status={sale.payment_status} /></td></tr>) : <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No sales have been recorded yet.</td></tr>}</tbody></table>
      </CardContent>
    </Card>
  );
}
