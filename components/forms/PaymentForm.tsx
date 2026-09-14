"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from 'next/link';

const emptyForm = (parentId: string, amount: number) => ({
  parent_id: parentId,
  date: new Date().toISOString().slice(0, 10),
  montant: amount,
  change: 0,
  payment_method: "cash",
  notes: "",
});

export function PaymentForm({
  endpoint,
  parentId,
  grandTotal,
  paidAmount,
}: {
  endpoint: string;
  parentId: string;
  grandTotal: number;
  paidAmount: number;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(
    emptyForm(parentId, Math.max(0, grandTotal - paidAmount)),
  );
  const load = useCallback(() => {
    axios
      .get(endpoint, { params: { parent_id: parentId } })
      .then(({ data }) => setPayments(data))
      .catch(error => toast.error(error.response?.data?.message || 'Unable to load payments'));
  }, [endpoint, parentId]);
  useEffect(() => {
    load();
  }, [load]);
  const recorded = payments.reduce((sum, payment) => sum + payment.montant, 0);
  const outstanding = Math.max(0, grandTotal - recorded);
  const maximum = outstanding + (editing?.montant ?? 0);

  function beginAdd() {
    setEditing(undefined);
    setForm(emptyForm(parentId, outstanding));
    setOpen(true);
  }

  function beginEdit(payment: any) {
    setEditing(payment);
    setForm({
      parent_id: parentId,
      date: new Date(payment.date).toISOString().slice(0, 10),
      montant: payment.montant,
      change: payment.change ?? 0,
      payment_method: payment.payment_method,
      notes: payment.notes ?? "",
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editing) await axios.put(`${endpoint}/${editing._id}`, form);
      else await axios.post(endpoint, form);
      toast.success(editing ? "Payment updated" : "Payment recorded");
      setOpen(false);
      setEditing(undefined);
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Payment failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this payment?")) return;
    try {
      await axios.delete(`${endpoint}/${id}`);
      toast.success("Payment deleted");
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Delete failed");
    }
  }

  return (
    <div className="form-section space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Payments</h2>
          <p className="text-xs text-muted-foreground">
            Outstanding {formatCurrency(outstanding)}
          </p>
        </div>
        {outstanding > 0.005 && (
          <button
            onClick={beginAdd}
            className="button-primary"
          >
            <Plus className="h-4 w-4" /> Add Payment
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-2 text-left">Reference</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Method</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-4 text-center text-muted-foreground"
                >
                  No payments
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment._id} className="border-t hover:bg-muted/30">
                  <td className="p-2"><Link className="text-primary underline" href={`/dashboard/payments/${endpoint.split('/').pop()}/${payment._id}`}>{payment.Ref}</Link></td>
                  <td className="p-2">{formatDate(payment.date)}</td>
                  <td className="p-2">{payment.payment_method}</td>
                  <td className="p-2 text-right">
                    {formatCurrency(payment.montant)}
                  </td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => beginEdit(payment)}
                        className="table-action-btn text-warning"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(payment._id)}
                        className="table-action-btn text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
          <form
            onSubmit={save}
            className="w-full max-w-lg space-y-5 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
          >
            <div className="flex justify-between">
              <h3 className="font-semibold">
                {editing ? "Edit Payment" : "Add Payment"}
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="table-action-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Date</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="input-label">Amount</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  max={maximum}
                  step="0.01"
                  value={form.montant}
                  onChange={(e) =>
                    setForm({ ...form, montant: Number(e.target.value) })
                  }
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="input-label">Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({ ...form, payment_method: e.target.value })
                  }
                  className="form-input w-full"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>
              <div>
                <label className="input-label">Change</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.change}
                  onChange={(e) =>
                    setForm({ ...form, change: Number(e.target.value) })
                  }
                  className="form-input w-full"
                />
              </div>
            </div>
            <div>
              <label className="input-label">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="form-input w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="button-outline">Cancel</button>
              <button disabled={saving} className="button-primary">
                {editing ? "Update Payment" : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
