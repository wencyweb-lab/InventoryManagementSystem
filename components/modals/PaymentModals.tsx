"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, DollarSign, Loader2, Trash2, X } from "lucide-react";

export function AddPaymentModal({
  open,
  onClose,
  endpoint,
  parentId,
  reference,
  grandTotal,
  paidAmount,
  onPaymentAdded,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  parentId: string;
  reference: string;
  grandTotal: number;
  paidAmount: number;
  onPaymentAdded: () => void;
}) {
  const outstanding = Math.max(0, grandTotal - paidAmount);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [montant, setMontant] = useState(outstanding);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [change, setChange] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMontant(Math.max(0, grandTotal - paidAmount));
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("cash");
      setChange(0);
      setNotes("");
    }
  }, [open, grandTotal, paidAmount]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (montant <= 0) return toast.error("Payment amount must be greater than 0");
    if (montant > outstanding + 0.01) {
      return toast.error(`Payment cannot exceed outstanding amount of ${formatCurrency(outstanding)}`);
    }

    setLoading(true);
    try {
      await axios.post(endpoint, {
        parent_id: parentId,
        date,
        montant: Number(montant),
        payment_method: paymentMethod,
        change: Number(change),
        notes,
      });
      toast.success("Payment recorded successfully");
      onPaymentAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Add Payment</h2>
              <p className="text-xs text-muted-foreground">Order Ref: {reference}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg text-sm border">
          <div>
            <span className="text-muted-foreground text-xs block">Grand Total:</span>
            <span className="font-semibold text-foreground">{formatCurrency(grandTotal)}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Outstanding:</span>
            <span className="font-bold text-destructive">{formatCurrency(outstanding)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Paying Amount *</label>
            <input
              type="number"
              required
              min="0.01"
              max={outstanding}
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value))}
              className="form-input w-full font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="form-input w-full"
            >
              <option value="cash">Cash</option>
              <option value="card">Credit / Debit Card</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="input-label">Change Given</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={change}
              onChange={(e) => setChange(Number(e.target.value))}
              className="form-input w-full"
            />
          </div>
        </div>

        <div>
          <label className="input-label">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input min-h-16 w-full"
            placeholder="Payment note, transaction or check number..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="button-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Save Payment
          </button>
        </div>
      </form>
    </div>
  );
}

export function ViewPaymentsModal({
  open,
  onClose,
  endpoint,
  parentId,
  reference,
  grandTotal,
  onPaymentsChanged,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  parentId: string;
  reference: string;
  grandTotal: number;
  onPaymentsChanged: () => void;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const res = await axios.get(endpoint, { params: { parent_id: parentId } });
      setPayments(res.data || []);
    } catch (err) {
      toast.error("Error loading payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPayments();
    }
  }, [open, parentId]);

  if (!open) return null;

  const totalPaid = payments.reduce((sum, p) => sum + (p.montant || 0), 0);
  const remaining = Math.max(0, grandTotal - totalPaid);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return;
    try {
      await axios.delete(`${endpoint}/${id}`);
      toast.success("Payment deleted");
      fetchPayments();
      onPaymentsChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete payment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Payment History</h2>
              <p className="text-xs text-muted-foreground">Order Ref: {reference}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg text-sm border">
          <div>
            <span className="text-muted-foreground text-xs block">Grand Total:</span>
            <span className="font-semibold text-foreground">{formatCurrency(grandTotal)}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Paid:</span>
            <span className="font-semibold text-success">{formatCurrency(totalPaid)}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Remaining Due:</span>
            <span className="font-bold text-destructive">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ref</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No payments have been recorded for this transaction.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{p.Ref}</td>
                    <td className="px-3 py-2">{formatDate(p.date)}</td>
                    <td className="px-3 py-2 capitalize">{p.payment_method?.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.montant)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p._id)}
                        className="table-action-btn text-destructive hover:bg-destructive/10"
                        title="Delete payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
