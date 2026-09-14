"use client";

import { useState } from "react";
import { CreditCard, Loader2, Printer, X, UserPlus, Settings2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import axios from "axios";
import toast from "react-hot-toast";

export function PosCheckoutDialog({
  open,
  total,
  method,
  tendered,
  notes,
  loading,
  onMethod,
  onTendered,
  onNotes,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number;
  method: string;
  tendered: number;
  notes: string;
  loading: boolean;
  onMethod: (value: string) => void;
  onTendered: (value: number) => void;
  onNotes: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const quickCashIncrements = [10, 20, 50, 100, 500];

  const handleExact = () => {
    onTendered(total);
  };

  const handleAddAmount = (amount: number) => {
    onTendered(Math.round(((tendered || total) + amount) * 100) / 100);
  };

  const handleRoundNext = (step: number) => {
    const nextVal = Math.ceil(total / step) * step;
    onTendered(nextVal === total ? total + step : nextVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-lg space-y-5 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Complete Payment</h2>
            <p className="text-sm text-muted-foreground">
              Amount due {formatCurrency(total)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="input-label">Payment method</label>
            <select
              value={method}
              onChange={(event) => {
                onMethod(event.target.value);
                if (event.target.value !== "cash") onTendered(total);
              }}
              className="form-input w-full"
            >
              <option value="cash">Cash</option>
              <option value="card">Card (record only)</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
          </div>
          <div>
            <label className="input-label">Tendered</label>
            <input
              type="number"
              min={total}
              step="0.01"
              value={tendered}
              onChange={(event) => onTendered(Number(event.target.value))}
              className="form-input w-full"
            />
          </div>
        </div>

        {/* Quick Cash Tender Buttons */}
        {method === "cash" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Cash Tender
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleExact}
                className="px-2.5 py-1 text-xs font-semibold rounded border bg-secondary/70 hover:bg-secondary transition-colors"
              >
                Exact ({formatCurrency(total)})
              </button>
              {quickCashIncrements.map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleAddAmount(inc)}
                  className="px-2.5 py-1 text-xs font-medium rounded border bg-background hover:bg-muted transition-colors"
                >
                  +{inc}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleRoundNext(10)}
                className="px-2.5 py-1 text-xs font-medium rounded border bg-background hover:bg-muted transition-colors"
              >
                Round $10
              </button>
              <button
                type="button"
                onClick={() => handleRoundNext(50)}
                className="px-2.5 py-1 text-xs font-medium rounded border bg-background hover:bg-muted transition-colors"
              >
                Round $50
              </button>
              <button
                type="button"
                onClick={() => handleRoundNext(100)}
                className="px-2.5 py-1 text-xs font-medium rounded border bg-background hover:bg-muted transition-colors"
              >
                Round $100
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-muted/60 p-4 ring-1 ring-foreground/10">
          <div className="flex justify-between">
            <span>Total</span>
            <strong className="text-foreground">{formatCurrency(total)}</strong>
          </div>
          <div className="mt-2 flex justify-between text-success font-semibold">
            <span>Change Return</span>
            <strong>{formatCurrency(Math.max(0, tendered - total))}</strong>
          </div>
        </div>

        <div>
          <label className="input-label">Payment note</label>
          <textarea
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
            className="form-input min-h-16 w-full"
            placeholder="Optional order notes or check number..."
          />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}{" "}
          Confirm Payment
        </button>
      </div>
    </div>
  );
}

export function PosQuickCustomerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: any) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Customer name is required");
    setLoading(true);
    try {
      const res = await axios.post("/api/clients", {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        adresse: address.trim() || undefined,
      });
      const created = res.data?.data || res.data;
      toast.success("Customer added successfully");
      onCreated(created);
      onClose();
      setName("");
      setPhone("");
      setEmail("");
      setCity("");
      setAddress("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Add Customer</h2>
          </div>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="input-label">Customer Name *</label>
          <input
            type="text"
            required
            placeholder="Full Name or Business"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Phone</label>
            <input
              type="text"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">City</label>
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Address</label>
            <input
              type="text"
              placeholder="Street address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="form-input w-full"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="button-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Save Customer
          </button>
        </div>
      </form>
    </div>
  );
}

export function PosCartItemDetailModal({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: any;
  onClose: () => void;
  onSave: (updated: {
    unit_price: number;
    discount: number;
    discount_method: string;
    tax_percent: number;
    tax_method: string;
  }) => void;
}) {
  const [unitPrice, setUnitPrice] = useState<number>(item?.unit_price ?? 0);
  const [discount, setDiscount] = useState<number>(item?.discount ?? 0);
  const [discountMethod, setDiscountMethod] = useState<string>(item?.discount_method ?? "1");
  const [taxPercent, setTaxPercent] = useState<number>(item?.tax_percent ?? 0);
  const [taxMethod, setTaxMethod] = useState<string>(item?.tax_method ?? "1");

  // Keep state synced with incoming item
  const [prevItemKey, setPrevItemKey] = useState<string>("");
  const itemKey = item ? `${item.product_id}-${item.variant_id}` : "";
  if (item && itemKey !== prevItemKey) {
    setPrevItemKey(itemKey);
    setUnitPrice(item.unit_price ?? 0);
    setDiscount(item.discount ?? 0);
    setDiscountMethod(item.discount_method ?? "1");
    setTaxPercent(item.tax_percent ?? 0);
    setTaxMethod(item.tax_method ?? "1");
  }

  if (!open || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      unit_price: Number(unitPrice),
      discount: Number(discount),
      discount_method: discountMethod,
      tax_percent: Number(taxPercent),
      tax_method: taxMethod,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit Item Details</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[280px]">
              {item.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="input-label">Unit Price ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
            className="form-input w-full font-semibold"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Discount</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Discount Method</label>
            <select
              value={discountMethod}
              onChange={(e) => setDiscountMethod(e.target.value)}
              className="form-input w-full"
            >
              <option value="1">Fixed ($)</option>
              <option value="2">Percentage (%)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Tax Rate (%)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Tax Method</label>
            <select
              value={taxMethod}
              onChange={(e) => setTaxMethod(e.target.value)}
              className="form-input w-full"
            >
              <option value="1">Exclusive</option>
              <option value="2">Inclusive</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" className="button-primary">
            Apply Changes
          </button>
        </div>
      </form>
    </div>
  );
}

export function PosReceipt({
  receipt,
  posSettings,
  systemSettings,
  onClose,
}: {
  receipt: any;
  posSettings: any;
  systemSettings: any;
  onClose: () => void;
}) {
  if (!receipt) return null;
  return (
    <div className="pos-receipt-overlay fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="receipt-print my-auto w-full max-w-sm rounded-xl bg-white p-6 text-black shadow-2xl animate-scale-in">
        <div className="text-center">
          <h2 className="text-xl font-bold">
            {systemSettings.CompanyName ?? "Stocky"}
          </h2>
          {posSettings.show_address && systemSettings.CompanyAdress && (
            <p className="text-xs">{systemSettings.CompanyAdress}</p>
          )}
          {posSettings.show_phone && systemSettings.CompanyPhone && (
            <p className="text-xs">{systemSettings.CompanyPhone}</p>
          )}
          {posSettings.show_email && systemSettings.email && (
            <p className="text-xs">{systemSettings.email}</p>
          )}
          <p className="mt-2 text-sm font-semibold">
            Receipt {receipt.sale.Ref}
          </p>
        </div>
        {posSettings.show_customer && (
          <div className="mt-4 border-y py-2 text-xs">
            <span>Customer: </span>
            <strong>{receipt.client?.name ?? "Walk-in"}</strong>
          </div>
        )}
        <div className="my-3 space-y-2 text-xs">
          {receipt.items.map((item: any) => (
            <div key={`${item.product_id}:${item.variant_id ?? ""}`}>
              <div className="flex justify-between gap-2">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <strong>{formatCurrency(item.subtotal)}</strong>
              </div>
              {posSettings.show_barcode && (
                <div className="text-[10px] text-gray-500">{item.code}</div>
              )}
              {posSettings.show_discount && item.discount > 0 && (
                <div className="text-[10px] text-gray-500">
                  Discount: {item.discount}
                  {item.discount_method === "1" ? "$" : "%"}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t pt-2 text-sm">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(receipt.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tendered</span>
            <span>
              {formatCurrency(receipt.total + (receipt.payment?.change ?? 0))}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Change</span>
            <span>{formatCurrency(receipt.payment?.change ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Method</span>
            <span>{receipt.payment?.payment_method ?? "cash"}</span>
          </div>
        </div>
        {posSettings.show_note && posSettings.note_customer && (
          <p className="mt-4 text-center text-xs">
            {posSettings.note_customer}
          </p>
        )}
        <div className="mt-5 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium hover:bg-gray-100"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
