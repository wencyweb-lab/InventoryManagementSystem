"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Pencil, Printer, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PaymentForm } from "@/components/forms/PaymentForm";
import toast from "react-hot-toast";


export function TransactionDetail({
  endpoint,
  backPath,
  editPath,
  title,
  paymentEndpoint,
  communicationResource,
  convertPath,
}: {
  endpoint: string;
  backPath: string;
  editPath?: string;
  title: string;
  paymentEndpoint?: string;
  communicationResource?:
    | "sale"
    | "purchase"
    | "quotation"
    | "sale-return"
    | "purchase-return";
  /** For quotations: the /api/quotations/[id]/convert URL used to pre-fill sale form */
  convertPath?: string;
}) {
  const router = useRouter();
  const [document, setDocument] = useState<any>();
  const [error, setError] = useState("");
  const [sending, setSending] = useState<"email" | "sms">();
  const [converting, setConverting] = useState(false);
  useEffect(() => {
    axios
      .get(endpoint)
      .then(({ data }) => setDocument(data))
      .catch((reason) =>
        setError(reason.response?.data?.message ?? "Unable to load document"),
      );
  }, [endpoint]);
  if (error)
    return (
      <div className="rounded-lg border border-destructive/40 p-6 text-destructive">
        {error}
      </div>
    );
  if (!document)
    return (
      <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>
    );
  const party = document.client_id ?? document.provider_id;
  async function send(channel: "email" | "sms") {
    if (!communicationResource) return;
    setSending(channel);
    try {
      const { data } = await axios.post("/api/communications", {
        channel,
        resource: communicationResource,
        document_id: document._id,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success(data.message);
    } catch (reason: any) {
      toast.error(
        reason.response?.data?.message ?? `${channel} delivery failed`,
      );
    } finally {
      setSending(undefined);
    }
  }

  async function convertToSale() {
    if (!convertPath) return;
    // Extract the document id from the convert URL and redirect to sale create
    // with the ?quotation= param — the sale form handles the preload natively.
    setConverting(true);
    try {
      // convertPath is like /api/quotations/{id}/convert — extract the id
      const match = convertPath.match(/\/api\/quotations\/([^/]+)\/convert/);
      if (!match) throw new Error('Invalid convert path');
      router.push(`/dashboard/sales/create?quotation=${match[1]}`);
    } catch (reason: any) {
      toast.error(reason.message ?? 'Failed to prepare sale conversion');
      setConverting(false);
    }
  }
  return (
    <div className="print-document mx-auto max-w-5xl space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={backPath} className="table-action-btn print:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="page-title">
              {title} {document.Ref}
            </h1>
            <p className="page-description">
              {formatDate(document.date)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {convertPath && (
            <button
              disabled={converting}
              type="button"
              onClick={convertToSale}
              className="button-primary"
              title="Convert this quotation into a sale"
            >
              <RefreshCw className={`h-4 w-4 ${converting ? 'animate-spin' : ''}`} />
              {converting ? 'Converting…' : 'Convert to Sale'}
            </button>
          )}
          {communicationResource && (
            <>
              <button
                disabled={Boolean(sending)}
                type="button"
                onClick={() => send("email")}
                className="button-outline"
              >
                <Mail className="h-4 w-4" />{" "}
                {sending === "email" ? "Sending…" : "Email"}
              </button>
              <button
                disabled={Boolean(sending)}
                type="button"
                onClick={() => send("sms")}
                className="button-outline"
              >
                <MessageSquare className="h-4 w-4" />{" "}
                {sending === "sms" ? "Sending…" : "SMS"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="button-outline"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          {editPath && (
            <Link
              href={editPath}
              className="button-outline"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {party && (
          <div className="form-section">
            <p className="detail-label">Party</p>
            <p className="detail-value">{party.name}</p>
          </div>
        )}
        <div className="form-section">
          <p className="detail-label">Warehouse</p>
          <p className="detail-value">
            {document.warehouse_id?.name ??
              document.from_warehouse_id?.name ??
              "—"}
          </p>
        </div>
        {document.to_warehouse_id && (
          <div className="form-section">
            <p className="detail-label">Destination</p>
            <p className="detail-value">{document.to_warehouse_id.name}</p>
          </div>
        )}
        {document.status && (
          <div className="form-section">
            <p className="detail-label">Status</p>
            <StatusBadge status={document.status} />
          </div>
        )}
        {document.payment_status && (
          <div className="form-section">
            <p className="detail-label">Payment</p>
            <StatusBadge status={document.payment_status} />
          </div>
        )}
      </div>
      <div className="form-section overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Product</th>
              <th className="p-3 text-right">Quantity</th>
              <th className="p-3 text-right">Unit price</th>
              <th className="p-3 text-right">Tax</th>
              <th className="p-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(document.details ?? []).map((line: any) => (
              <tr key={line._id} className="border-b border-border/50">
                <td className="p-3 font-medium">
                  {line.product_id?.name ?? line.name ?? "Product"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {line.product_id?.code}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {line.type ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${line.type === 'add' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                      {line.type === 'add' ? '+ Addition' : '- Subtraction'} ({line.quantity})
                    </span>
                  ) : (
                    <>{line.quantity} {line.unit_id?.short_name ?? ""}</>
                  )}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(
                    line.unit_price ?? line.Net_price ?? line.cost ?? 0,
                  )}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(line.tax_net ?? 0)}
                </td>
                <td className="p-3 text-right font-medium">
                  {formatCurrency(line.subtotal ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {title === "Adjustment" ? (
        <div className="ml-auto max-w-sm form-section space-y-2">
          <div className="detail-row">
            <span>Total Adjusted Lines</span>
            <span className="font-bold">{document.details?.length ?? 0}</span>
          </div>
        </div>
      ) : (
        <div className="ml-auto max-w-sm form-section space-y-2">
          <div className="detail-row">
            <span>Discount</span>
            <span>{formatCurrency(document.discount ?? 0)}</span>
          </div>
          <div className="detail-row">
            <span>Order tax</span>
            <span>{formatCurrency(document.TaxNet ?? 0)}</span>
          </div>
          <div className="detail-row">
            <span>Shipping</span>
            <span>{formatCurrency(document.shipping ?? 0)}</span>
          </div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold">
            <span>Grand total</span>
            <span>{formatCurrency(document.GrandTotal ?? 0)}</span>
          </div>
          {document.paid_amount !== undefined && (
            <div className="detail-row">
              <span>Paid</span>
              <span>{formatCurrency(document.paid_amount)}</span>
            </div>
          )}
        </div>
      )}
      {document.notes && (
        <div className="form-section">
          <p className="detail-label">Notes</p>
          <p className="mt-2 whitespace-pre-wrap">{document.notes}</p>
        </div>
      )}
      {paymentEndpoint && (
        <PaymentForm
          endpoint={paymentEndpoint}
          parentId={document._id}
          grandTotal={document.GrandTotal}
          paidAmount={document.paid_amount ?? 0}
        />
      )}
    </div>
  );
}
