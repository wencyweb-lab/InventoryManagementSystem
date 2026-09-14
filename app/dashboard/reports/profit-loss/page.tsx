"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Loader2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfitLossPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(new Date().getFullYear() + '-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    axios.get('/api/reports', { params: { type: 'profit_loss', from, to }, signal: controller.signal }).then(({ data: response }) => setData(response)).catch(reason => { if (!axios.isCancel(reason)) setError(reason.response?.data?.message || 'Unable to load report'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [from, to]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const sales = Number(data?.saleTotal ?? 0);
  const purchases = Number(data?.purchaseTotal ?? 0);
  const profit = Number(data?.profit ?? 0);
  const chart = [{ label: "Sales", amount: sales, fill: "var(--success)" }, { label: "Purchases", amount: purchases, fill: "var(--warning)" }, { label: "Net profit", amount: profit, fill: "var(--primary)" }];
  const margin = sales > 0 ? (profit / sales) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Profit and loss</h1><p className="page-description">A visual summary of revenue, purchasing cost and net profitability.</p></div><span className="badge-primary gap-1.5"><TrendingUp className="h-3 w-3" />{margin.toFixed(1)}% margin</span></div>
      <div className="flex flex-wrap gap-4"><label>From <input aria-label="Report from" type="date" className="form-input" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To <input aria-label="Report to" type="date" className="form-input" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">{[['Payments received', data?.payment_received], ['Payments sent (including expenses)', data?.payment_sent], ['Net payments', data?.payment_net]].map(([label, amount]) => <div key={label} className="form-section"><p className="detail-label">{label}</p><p className="detail-value">{formatCurrency(Number(amount ?? 0))}</p></div>)}</div>
      <div className="grid gap-6 md:grid-cols-3">
        {[{ label: "Total sales", value: sales, icon: ArrowUpRight, tone: "bg-success/10 text-success" }, { label: "Total purchases", value: purchases, icon: ArrowDownRight, tone: "bg-warning/10 text-warning" }, { label: "Net profit", value: profit, icon: CircleDollarSign, tone: profit >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive" }].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="gap-4"><CardHeader className="flex-row items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-sm ${tone}`}><Icon className="h-4 w-4" /></span><span className="text-2xl font-medium">{formatCurrency(value)}</span></CardHeader><CardContent><p className="font-semibold">{label}</p><p className="mt-1 text-sm text-muted-foreground">Current reporting period</p></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-lg font-semibold">Financial comparison</CardTitle><p className="text-sm text-muted-foreground">Sales, purchases and the resulting profit</p></CardHeader><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} barSize={48}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => `$${value}`} /><Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} /><Bar dataKey="amount" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card className="justify-between"><CardHeader><CardTitle className="text-lg font-semibold">Profitability</CardTitle><p className="text-sm text-muted-foreground">How much sales income remains after purchases</p></CardHeader><CardContent className="space-y-6"><div><p className="text-5xl font-light tracking-tight">{margin.toFixed(1)}%</p><p className="mt-2 text-sm text-muted-foreground">Net margin</p></div><div className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Revenue retained</span><span className="font-medium">{formatCurrency(profit)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, margin))}%` }} /></div><p className="rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">A positive margin means recorded sales exceed purchasing cost for this period. Expenses may be represented separately by your configured reports.</p></div></CardContent></Card>
      </div>
    </div>
  );
}

