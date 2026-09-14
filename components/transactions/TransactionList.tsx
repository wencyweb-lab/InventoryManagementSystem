"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import { CreditCard, DollarSign, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExportButton } from "@/components/shared/ExportButton";
import { AddPaymentModal, ViewPaymentsModal } from "@/components/modals/PaymentModals";

const helper = createColumnHelper<any>();

export function TransactionList({
  title,
  description,
  endpoint,
  basePath,
  createLabel,
  exportResource,
  paymentEndpoint,
}: {
  title: string;
  description: string;
  endpoint: string;
  basePath: string;
  createLabel: string;
  exportResource?: string;
  paymentEndpoint?: string;
}) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  // Payment modals state
  const [addPaymentTarget, setAddPaymentTarget] = useState<any>(null);
  const [viewPaymentsTarget, setViewPaymentsTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 15, search };
      if (paymentStatus) params.payment_status = paymentStatus;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await axios.get(endpoint, { params });
      setData(response.data.data);
      setTotal(response.data.total);
      setLastPage(response.data.last_page);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, search, paymentStatus, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      if (!confirm("Delete this record and reverse its stock effect?")) return;
      try {
        await axios.delete(`${endpoint}/${id}`);
        toast.success("Record deleted");
        load();
      } catch (error: any) {
        toast.error(error.response?.data?.message ?? "Delete failed");
      }
    },
    [endpoint, load],
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      try {
        await axios.delete(endpoint, { data: { ids } });
        toast.success("Selected records deleted");
        load();
      } catch (error: any) {
        toast.error(error.response?.data?.message ?? "Delete failed");
      }
    },
    [endpoint, load],
  );

  const columns = useMemo(
    () => [
      helper.accessor("Ref", {
        header: "Reference",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      helper.accessor("date", {
        header: "Date",
        cell: (info) => formatDate(info.getValue()),
      }),
      helper.accessor(
        (row) => row.client_id?.name ?? row.provider_id?.name ?? "—",
        { id: "party", header: "Party" },
      ),
      helper.accessor((row) => row.warehouse_id?.name ?? "—", {
        id: "warehouse",
        header: "Warehouse",
      }),
      helper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      helper.accessor("GrandTotal", {
        header: "Total",
        cell: (info) => formatCurrency(info.getValue() ?? 0),
      }),
      ...(paymentEndpoint
        ? [
            helper.accessor("paid_amount", {
              header: "Paid",
              cell: (info) => formatCurrency(info.getValue() ?? 0),
            }),
          ]
        : []),
      helper.accessor("payment_status", {
        header: "Payment",
        cell: (info) =>
          info.getValue() ? <StatusBadge status={info.getValue()} /> : "—",
      }),
      helper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          const isFullyPaid = (row.paid_amount ?? 0) >= (row.GrandTotal ?? 0) - 0.01;

          return (
            <div className="flex items-center gap-1">
              {paymentEndpoint && !isFullyPaid && (
                <button
                  onClick={() => setAddPaymentTarget(row)}
                  className="table-action-btn flex items-center justify-center text-success/80 hover:text-success hover:bg-success/10"
                  title="Add payment"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
              )}
              {paymentEndpoint && (
                <button
                  onClick={() => setViewPaymentsTarget(row)}
                  className="table-action-btn flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10"
                  title="View payments"
                >
                  <DollarSign className="w-4 h-4" />
                </button>
              )}
              <Link
                href={`${basePath}/${row._id}`}
                className="table-action-btn"
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </Link>
              <Link
                href={`${basePath}/${row._id}/edit`}
                className="table-action-btn text-warning"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                onClick={() => remove(row._id)}
                className="table-action-btn text-destructive"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      }),
    ],
    [basePath, remove, paymentEndpoint],
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {exportResource && <ExportButton resource={exportResource} />}
          <Link
            href={`${basePath}/create`}
            className="button-primary"
          >
            <Plus className="h-4 w-4" /> {createLabel}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-4 form-section">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Payment</label>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="form-input h-9 py-1 text-sm pr-8"
          >
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="form-input h-9 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="form-input h-9 py-1 text-sm"
          />
        </div>
        {(paymentStatus || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setPaymentStatus("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        lastPage={lastPage}
        loading={loading}
        onPageChange={setPage}
        onSearch={(s) => {
          setSearch(s);
          setPage(1);
        }}
        onBulkDelete={handleBulkDelete}
      />

      {/* Payment Modals */}
      {paymentEndpoint && (
        <>
          <AddPaymentModal
            open={Boolean(addPaymentTarget)}
            onClose={() => setAddPaymentTarget(null)}
            endpoint={paymentEndpoint}
            parentId={addPaymentTarget?._id || ""}
            reference={addPaymentTarget?.Ref || ""}
            grandTotal={addPaymentTarget?.GrandTotal || 0}
            paidAmount={addPaymentTarget?.paid_amount || 0}
            onPaymentAdded={() => load()}
          />

          <ViewPaymentsModal
            open={Boolean(viewPaymentsTarget)}
            onClose={() => setViewPaymentsTarget(null)}
            endpoint={paymentEndpoint}
            parentId={viewPaymentsTarget?._id || ""}
            reference={viewPaymentsTarget?.Ref || ""}
            grandTotal={viewPaymentsTarget?.GrandTotal || 0}
            onPaymentsChanged={() => load()}
          />
        </>
      )}
    </div>
  );
}
