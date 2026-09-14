"use client";

import Link from "next/link";
import { ArrowUpRight, PackageSearch } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function InventoryInsightsCard({ alerts, productCount }: { alerts: { productName: string; productCode: string; currentQty: number; alertQty: number }[]; productCount: number }) {
  const chart = alerts.slice(0, 6).map((item) => ({ name: item.productCode, stock: item.currentQty, target: item.alertQty }));
  return (
    <Card className="justify-between gap-4">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><p className="text-lg font-semibold">Product insight</p><p className="mt-1 text-sm text-muted-foreground">Live inventory health</p></div>
        <span className="flex h-14 w-20 items-center justify-center rounded-md bg-muted"><PackageSearch className="h-6 w-6 text-muted-foreground" /></span>
      </CardHeader>
      <CardContent><div className="h-px bg-border" /></CardContent>
      <CardContent className="space-y-5">
        <div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Products tracked</p><p className="mt-1 text-2xl font-semibold">{productCount.toLocaleString()}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Low stock</p><p className="mt-1 text-2xl font-semibold text-destructive">{alerts.length}</p></div></div>
        <div className="h-28">
          {chart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><XAxis dataKey="name" hide /><Bar dataKey="target" fill="var(--muted)" radius={[4, 4, 4, 4]} /><Bar dataKey="stock" fill="var(--destructive)" radius={[4, 4, 4, 4]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-lg bg-muted/50 text-sm text-muted-foreground">All products are above alert levels</div>}
        </div>
        <Link href="/dashboard/reports/stock-alerts" className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-sm font-medium hover:bg-muted">Open stock report <ArrowUpRight className="h-4 w-4" /></Link>
      </CardContent>
    </Card>
  );
}
