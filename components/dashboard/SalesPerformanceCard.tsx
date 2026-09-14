import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgePercent, CircleDollarSign, PackageCheck, ShoppingBag, TrendingUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function SalesPerformanceCard({
  chartData,
  paymentChartData,
  metrics,
}: {
  chartData: { date: string; sales: number; purchases: number }[];
  paymentChartData?: { date: string; received: number; sent: number }[];
  metrics: { revenue: number; sales: number; purchases: number; orders: number; expenses: number };
}) {
  const [viewMode, setViewMode] = useState<"transactions" | "payments">("transactions");
  const positiveRevenue = Math.max(0, metrics.revenue);
  const outflow = Math.max(0, metrics.purchases + metrics.expenses);
  const total = positiveRevenue + outflow || 1;
  const margin = Math.round((positiveRevenue / total) * 100);
  const goalData = [{ name: "Revenue", value: positiveRevenue || 1, color: "var(--primary)" }, { name: "Outflow", value: outflow || 1, color: "var(--muted)" }];
  const summary = [
    { title: "Sales volume", value: formatCurrency(metrics.sales), icon: TrendingUp },
    { title: "Discount & expense", value: formatCurrency(metrics.expenses), icon: BadgePercent },
    { title: "Net revenue", value: formatCurrency(metrics.revenue), icon: CircleDollarSign },
    { title: "Total orders", value: metrics.orders.toLocaleString(), icon: ShoppingBag },
  ];

  return (
    <Card className="col-span-full gap-6 xl:col-span-2">
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <div>
              <CardTitle className="text-lg font-semibold">Sales metrics</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Live performance across sales and purchasing</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-background"><PackageCheck className="h-5 w-5" /></span>
              <div><p className="text-lg font-medium">Stocky Workspace</p><p className="text-sm text-muted-foreground">Today&apos;s operating summary</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.map(({ title, value, icon: Icon }) => (
                <div key={title} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="truncate text-xs font-medium text-muted-foreground">{title}</p><p className="truncate text-lg font-medium">{value}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-xl p-5 ring-1 ring-foreground/10 lg:col-span-2">
            <div><CardTitle className="text-lg font-semibold">Revenue balance</CardTitle><p className="mt-1 text-sm text-muted-foreground">Revenue against purchases and expenses</p></div>
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={goalData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={70} startAngle={90} endAngle={-270} strokeWidth={0}>{goalData.map((item) => <Cell key={item.name} fill={item.color} />)}<Label position="center" content={({ viewBox }: any) => viewBox?.cx ? <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle"><tspan x={viewBox.cx} y={viewBox.cy - 5} className="fill-foreground text-2xl font-medium">{margin}%</tspan><tspan x={viewBox.cx} y={viewBox.cy + 18} className="fill-muted-foreground text-xs">revenue share</tspan></text> : null} /></Pie><Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between"><span className="text-base">Operating balance</span><span className="text-xl font-medium">{formatCurrency(metrics.revenue)}</span></div>
          </div>
        </div>
      </CardContent>
      <CardContent>
        <div className="rounded-xl p-5 ring-1 ring-foreground/10">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-lg font-semibold">
                {viewMode === "transactions" ? "Sales vs purchases" : "Payment Sent vs Received"}
              </p>
              <p className="text-sm text-muted-foreground">
                {viewMode === "transactions" ? "Seven-day transaction volume" : "Seven-day settlement cash flow"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {paymentChartData && paymentChartData.length > 0 && (
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("transactions")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      viewMode === "transactions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("payments")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      viewMode === "payments" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Payment Trends
                  </button>
                </div>
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                {viewMode === "transactions" ? (
                  <>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Sales</span>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success" />Purchases</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success" />Received</span>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-destructive" />Sent</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === "transactions" ? (
                <BarChart data={chartData} barGap={3}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => value.slice(5)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} />
                  <Bar dataKey="sales" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="purchases" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              ) : (
                <BarChart data={paymentChartData || []} barGap={3}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => value.slice(5)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} />
                  <Bar dataKey="received" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="sent" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
