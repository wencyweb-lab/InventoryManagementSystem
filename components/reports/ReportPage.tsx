"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Eye } from "lucide-react";
export type ReportField = {
  key: string;
  label: string;
  format?: "currency" | "date" | "number";
};
const valueAt = (row: any, key: string) =>
  key.split(".").reduce((value, part) => value?.[part], row);
export function ReportPage({
  title,
  description,
  type,
  fields,
  rowLinkBase,
}: {
  title: string;
  description: string;
  type: string;
  fields: ReportField[];
  rowLinkBase?: string;
}) {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    axios
      .get("/api/reports", { params: { type, from, to }, signal: controller.signal })
      .then(({ data }) => setRows(data))
      .catch((error) => { if (!axios.isCancel(error)) { setRows([]); setError(error.response?.data?.message || 'Unable to load report'); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, from, to]);
  const show = (row: any, field: ReportField) => {
    const value = valueAt(row, field.key);
    if (field.format === "currency") return formatCurrency(Number(value ?? 0));
    if (field.format === "date") return value ? formatDate(value) : "—";
    if (field.format === "number") return Number(value ?? 0).toLocaleString();
    return String(value ?? "—");
  };
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div className="flex gap-3">
          <label className="text-xs">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="form-input ml-2"
            />
          </label>
          <label className="text-xs">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="form-input ml-2"
            />
          </label>
        </div>
      </div>
      <div className="data-table-shell overflow-x-auto">
        {error && <p role="alert" className="p-4 text-destructive">{error}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {fields.map((field) => (
                <th key={field.key} className="h-10 px-4 text-left text-xs font-medium">
                  {field.label}
                </th>
              ))}
              {rowLinkBase && <th className="h-10 px-4 text-right text-xs font-medium">Details</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={fields.length + (rowLinkBase ? 1 : 0)}
                  className="p-8 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={fields.length + (rowLinkBase ? 1 : 0)}
                  className="p-8 text-center text-muted-foreground"
                >
                  No records in this range
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row._id ?? index} className="border-b last:border-0 hover:bg-muted/40">
                  {fields.map((field) => (
                    <td key={field.key} className="px-4 py-3">
                      {show(row, field)}
                    </td>
                  ))}
                  {rowLinkBase && <td className="px-4 py-3 text-right"><Link href={`${rowLinkBase}/${row._id}`} className="table-action-btn"><Eye className="h-4 w-4" /></Link></td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
