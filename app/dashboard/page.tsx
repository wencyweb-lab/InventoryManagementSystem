"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { CircleDollarSign, Loader2, Package, ShoppingBag, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SalesPerformanceCard } from "@/components/dashboard/SalesPerformanceCard";
import { InventoryInsightsCard } from "@/components/dashboard/InventoryInsightsCard";
import { TopCustomersCard } from "@/components/dashboard/TopCustomersCard";
import { TopProductsCard } from "@/components/dashboard/TopProductsCard";
import { RecentSalesCard } from "@/components/dashboard/RecentSalesCard";


interface DashboardData {
  chartData: { date: string; sales: number; purchases: number }[];
  paymentChartData?: { date: string; received: number; sent: number }[];
  today: { sales: { total: number; count: number }; purchases: { total: number; count: number }; revenue: number; expenses: number };
  alerts: { productName: string; productCode: string; currentQty: number; alertQty: number }[];
  latestSales: any[];
  topCustomers: { name: string; total: number; count: number }[];
  topProducts: { name: string; code: string; quantity: number; revenue: number }[];
  totals: { products: number; customers: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/dashboard").then(({ data: response }) => setData(response)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="surface-card p-10 text-center text-muted-foreground">The dashboard could not be loaded.</div>;

  const { today } = data;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <div className="col-span-full flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-semibold tracking-tight">Operations overview</h1><p className="mt-1 text-sm text-muted-foreground">Inventory, sales, purchasing and customer activity in one place.</p></div><p className="text-xs text-muted-foreground">Live workspace data</p></div>
      <div className="col-span-full grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Today’s revenue" value={formatCurrency(today.revenue)} caption={`${today.sales.count} completed sales`} icon={CircleDollarSign} />
        <MetricCard title="Sales volume" value={formatCurrency(today.sales.total)} caption={`${today.sales.count} transactions`} icon={ShoppingBag} tone="success" />
        <MetricCard title="Purchasing" value={formatCurrency(today.purchases.total)} caption={`${today.purchases.count} purchase orders`} icon={ShoppingCart} tone="warning" />
        <MetricCard title="Stock alerts" value={data.alerts.length.toLocaleString()} caption={`${data.totals.products} products monitored`} icon={Package} tone={data.alerts.length ? "danger" : "default"} />
      </div>
      <div className="grid gap-6 max-xl:col-span-full lg:max-xl:grid-cols-2">
        <InventoryInsightsCard alerts={data.alerts} productCount={data.totals.products} />
        <TopCustomersCard customers={data.topCustomers} />
        <TopProductsCard products={data.topProducts ?? []} />
      </div>
      <SalesPerformanceCard chartData={data.chartData} paymentChartData={data.paymentChartData} metrics={{ revenue: today.revenue, sales: today.sales.total, purchases: today.purchases.total, orders: today.sales.count, expenses: today.expenses }} />
      <RecentSalesCard sales={data.latestSales} />
    </div>
  );
}
