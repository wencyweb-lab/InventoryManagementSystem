"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export function PartyReportDetail({
  type,
  id,
  backPath,
}: {
  type: "customer_detail" | "supplier_detail" | "warehouse_detail";
  id: string;
  backPath: string;
}) {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    axios
      .get("/api/reports", { params: { type, id, from, to }, signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((error) => { if (!axios.isCancel(error)) setError(error.response?.data?.message || 'Unable to load activity'); });
    return () => controller.abort();
  }, [from, id, to, type]);
  if (error) return <div role="alert" className="space-y-3"><p>{error}</p><Link href={backPath}>Back to report</Link></div>;
  if (!data) return <div>Loading…</div>;
  const party = data.customer ?? data.supplier ?? data.warehouse;
  const groups =
    type === "warehouse_detail" ? [
      ['Sales', data.sales], ['Purchases', data.purchases], ['Quotations', data.quotations],
      ['Sale returns', data.saleReturns], ['Purchase returns', data.purchaseReturns], ['Expenses', data.expenses],
    ] : type === "customer_detail"
      ? [
          ["Sales", data.sales],
          ["Quotations", data.quotations],
          ["Sale returns", data.returns],
          ["Payments", data.payments ?? []],
          ["Return payments", data.returnPayments ?? []],
        ]
      : [
          ["Purchases", data.purchases],
          ["Purchase returns", data.returns],
          ["Payments", data.payments ?? []],
          ["Return payments", data.returnPayments ?? []],
        ];
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={backPath} className="table-action-btn">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="page-title">{party.name}</h1>
            <p className="page-description">
              {party.email || party.phone || "Party activity report"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="form-input"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="form-input"
          />
        </div>
      </div>
      {data.stock && <section className="data-table-shell overflow-x-auto"><h2 className="border-b px-4 py-3 font-semibold">Current inventory (base units)</h2><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Product</th><th className="p-3 text-left">Variant</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-left">Unit</th></tr></thead><tbody>{data.stock.map((row: any) => <tr key={row._id} className="border-t"><td className="p-3">{row.product_id.code} — {row.product_id.name}</td><td className="p-3">{row.variantName}</td><td className="p-3 text-right">{row.qte}</td><td className="p-3">{row.product_id.unit_id?.short_name}</td></tr>)}{!data.stock.length && <tr><td colSpan={4} className="p-4 text-center">No inventory records</td></tr>}</tbody></table></section>}
      {groups.map(([label, rows]: any) => (
        <section key={label} className="data-table-shell">
          <h2 className="border-b px-4 py-3 font-semibold">{label}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-foreground">
                <th className="p-3">Reference</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row: any) => (
                  <tr key={row._id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{row.Ref}</td>
                    <td className="p-3">{formatDate(row.date)}</td>
                    <td className="p-3">{row.status ?? row.payment_method}</td>
                    <td className="p-3 text-right">
                      {formatCurrency(row.GrandTotal ?? row.montant ?? row.amount ?? 0)}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(row.paid_amount ?? row.montant ?? 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No records in this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
