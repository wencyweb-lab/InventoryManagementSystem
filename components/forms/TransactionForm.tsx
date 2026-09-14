"use client";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Trash2, Search, Loader2 } from "lucide-react";
import { calcLine, calcGrandTotal } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { QuickPersonModal } from "@/components/modals/QuickCreateModals";

const id = (value: any) => value?._id ?? value ?? "";

type CommercialFormType =
  | "sale"
  | "purchase"
  | "quotation"
  | "sale-return"
  | "purchase-return";

const FORM_CONFIG: Record<
  CommercialFormType,
  { endpoint: string; listPath: string; party: "client" | "provider" }
> = {
  sale: {
    endpoint: "/api/sales",
    listPath: "/dashboard/sales",
    party: "client",
  },
  purchase: {
    endpoint: "/api/purchases",
    listPath: "/dashboard/purchases",
    party: "provider",
  },
  quotation: {
    endpoint: "/api/quotations",
    listPath: "/dashboard/quotations",
    party: "client",
  },
  "sale-return": {
    endpoint: "/api/returns/sale",
    listPath: "/dashboard/sale-returns",
    party: "client",
  },
  "purchase-return": {
    endpoint: "/api/returns/purchase",
    listPath: "/dashboard/purchase-returns",
    party: "provider",
  },
};

export function TransactionForm({
  type,
  initialData,
  preloadUrl,
}: {
  type: CommercialFormType;
  initialData?: any;
  preloadUrl?: string;
}) {
  const router = useRouter();
  const config = FORM_CONFIG[type];
  const isPurchaseFlow = config.party === "provider";
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]); // clients or suppliers
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [quickPersonOpen, setQuickPersonOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid" | "partial">("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [payingAmount, setPayingAmount] = useState<number | "">("");
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const preparedInitialData = initialData
    ? {
        ...initialData,
        date: new Date(initialData.date).toISOString().slice(0, 10),
        warehouse_id:
          initialData.warehouse_id?._id ?? initialData.warehouse_id ?? "",
        people_id:
          config.party === "provider"
            ? (initialData.provider_id?._id ?? initialData.provider_id ?? "")
            : (initialData.client_id?._id ?? initialData.client_id ?? ""),
        details: (initialData.details ?? []).map((detail: any) => ({
          ...detail,
          product_id: detail.product_id?._id ?? detail.product_id,
          name: detail.product_id?.name ?? detail.name ?? "Product",
          code: detail.product_id?.code ?? detail.code ?? "",
          unit_id: detail.unit_id?._id ?? detail.unit_id ?? null,
          unit_name: detail.unit_id?.short_name ?? detail.unit_id?.name ?? detail.unit_name ?? "",
          variant_id: detail.variant_id?._id ?? detail.variant_id ?? null,
        })),
      }
    : undefined;

  const { register, control, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: preparedInitialData || {
      date: new Date().toISOString().split("T")[0],
      warehouse_id: "",
      people_id: "", // client_id or provider_id
      status:
        type === "sale"
          ? "completed"
          : type === "purchase"
            ? "received"
            : type === "quotation"
              ? "sent"
              : type === "sale-return"
                ? "received"
                : "completed",
      tax_rate: 0,
      discount: 0,
      shipping: 0,
      notes: "",
      details: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "details",
  });
  const watchDetails = watch("details");
  const orderTaxRate = watch("tax_rate") || 0;
  const orderDiscount = watch("discount") || 0;
  const orderShipping = watch("shipping") || 0;
  const warehouseId = watch("warehouse_id");

  useEffect(() => {
    axios
      .get("/api/warehouses?all=true")
      .then((res) => setWarehouses(res.data));
    const peopleUrl = isPurchaseFlow
      ? "/api/providers?all=true"
      : "/api/clients?all=true";
    axios.get(peopleUrl).then((res) => setPeople(res.data));
  }, [isPurchaseFlow]);

  useEffect(() => {
    if (!preloadUrl || initialData) return;
    axios
      .get(preloadUrl)
      .then(({ data }) =>
        reset({
          ...data,
          date: new Date(data.date).toISOString().slice(0, 10),
          warehouse_id: id(data.warehouse_id),
          people_id: id(
            config.party === "provider" ? data.provider_id : data.client_id,
          ),
          details: (data.details ?? []).map((detail: any) => ({
            ...detail,
            product_id: id(detail.product_id),
            unit_id: id(detail.unit_id) || null,
            unit_name: detail.unit_id?.short_name ?? detail.unit_id?.name ?? detail.unit_name ?? "",
            variant_id: id(detail.variant_id) || null,
          })),
        }),
      )
      .catch((error) =>
        toast.error(
          error.response?.data?.message ?? "Unable to load quotation",
        ),
      );
  }, [config.party, initialData, preloadUrl, reset]);

  useEffect(() => {
    if (search.length < 2 || !warehouseId) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const stockUnit = isPurchaseFlow ? "purchase" : "sale";
        const res = await axios.get(
          `/api/products?search=${search}&warehouse_id=${warehouseId}&stock_unit=${stockUnit}`,
        );
        setProducts(res.data.data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, warehouseId, isPurchaseFlow]);

  const addProduct = (product: any, variant?: any) => {
    const variantId = variant?._id ?? null;
    const existingIdx = fields.findIndex(
      (f: any) =>
        f.product_id === product._id && (f.variant_id ?? null) === variantId,
    );
    if (existingIdx >= 0) {
      const current = watchDetails[existingIdx] as any;
      updateLine(existingIdx, { ...current, quantity: current.quantity + 1 });
      toast.success("Quantity increased");
    } else {
      const unitPrice = isPurchaseFlow ? product.cost : product.price;
      const calculation = calcLine({
        unitPrice,
        quantity: 1,
        discount: 0,
        discountMethod: "1",
        taxRate: product.TaxNet,
        taxMethod: product.tax_method,
      });
      const unitObj = isPurchaseFlow
        ? product.purchase_unit_id || product.unit_id
        : product.sale_unit_id || product.unit_id;
      const unitName = unitObj?.short_name || unitObj?.name || "";

      append({
        product_id: product._id,
        variant_id: variantId,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        code: variant?.code ?? product.code,
        quantity: 1,
        unit_id: isPurchaseFlow
          ? product.purchase_unit_id?._id || product.unit_id?._id
          : product.sale_unit_id?._id || product.unit_id?._id,
        unit_name: unitName,
        unit_price: unitPrice,
        discount: 0,
        discount_method: "1",
        tax_method: product.tax_method,
        tax_percent: product.TaxNet,
        tax_net: calculation.taxAmount,
        Net_price: calculation.net,
        subtotal: calculation.subtotal,
      });
      setSearch("");
    }
  };

  const updateLine = (index: number, lineData: any) => {
    let calc;
    try {
      calc = calcLine({
        unitPrice: lineData.unit_price,
        quantity: lineData.quantity,
        discount: lineData.discount,
        discountMethod: lineData.discount_method,
        taxRate: lineData.tax_percent,
        taxMethod: lineData.tax_method,
      });
    } catch {
      update(index, { ...lineData, tax_net: 0, Net_price: 0, subtotal: 0 });
      return;
    }
    update(index, {
      ...lineData,
      tax_net: calc.taxAmount,
      Net_price: calc.net,
      subtotal: calc.subtotal,
    });
  };

  const detailTotal = watchDetails.reduce(
    (sum: number, detail: any) => sum + (detail.subtotal || 0),
    0,
  );
  const totals = calcGrandTotal({
    lineSubtotals: watchDetails.map((d: any) => d.subtotal || 0),
    orderDiscount: Math.min(parseFloat(orderDiscount as any) || 0, detailTotal),
    orderTaxRate: parseFloat(orderTaxRate as any) || 0,
    shipping: parseFloat(orderShipping as any) || 0,
  });

  useEffect(() => {
    if (paymentStatus === "paid") {
      setPayingAmount(totals.grandTotal);
      setReceivedAmount(totals.grandTotal);
    }
  }, [totals.grandTotal, paymentStatus]);

  const onSubmit = async (data: any) => {
    if (!data.details.length) return toast.error("Add at least one product");
    const submittedDetailTotal = data.details.reduce(
      (sum: number, detail: any) => sum + (detail.subtotal || 0),
      0,
    );
    if (Number(data.discount) > submittedDetailTotal)
      return toast.error("Order discount cannot exceed the item total");
    setLoading(true);
    try {
      const payload: any = {
        ...data,
        [config.party === "provider" ? "provider_id" : "client_id"]:
          data.people_id,
      };
      if (!isEdit && (type === "sale" || type === "purchase") && paymentStatus !== "unpaid" && Number(payingAmount) > 0) {
        if (Number(payingAmount) > totals.grandTotal + 0.005) {
          toast.error(`Payment cannot exceed the grand total (${totals.grandTotal.toFixed(2)})`);
          return;
        }
        payload.payment = {
          status: paymentStatus,
          amount: Number(payingAmount),
          received_amount: receivedAmount !== "" ? Number(receivedAmount) : Number(payingAmount),
          change: receivedAmount !== "" && Number(receivedAmount) > Number(payingAmount) ? Number(receivedAmount) - Number(payingAmount) : 0,
          Reglement: paymentMethod,
          notes: paymentNotes,
        };
      }
      if (isEdit)
        await axios.put(`${config.endpoint}/${initialData._id}`, payload);
      else await axios.post(config.endpoint, payload);
      toast.success("Saved successfully");
      router.push(config.listPath);
      router.refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="form-section md:col-span-2">
          <h2 className="text-base font-semibold mb-4">Transaction Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Date</label>
              <input
                required
                type="date"
                {...register("date")}
                className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="input-label">Warehouse</label>
              <select
                required
                {...register("warehouse_id")}
                className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w: any) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="input-label mb-0">
                  {isPurchaseFlow ? "Supplier" : "Customer"} *
                </label>
                <button
                  type="button"
                  onClick={() => setQuickPersonOpen(true)}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Quick Add
                </button>
              </div>
              <select
                required
                {...register("people_id")}
                className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
              >
                <option value="">
                  Select {isPurchaseFlow ? "Supplier" : "Customer"}
                </option>
                {people.map((p: any) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select
                {...register("status")}
                className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
              >
                {type === "sale" && (
                  <>
                    <option value="ordered">Ordered</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </>
                )}
                {type === "purchase" && (
                  <>
                    <option value="ordered">Ordered</option>
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                  </>
                )}
                {type === "quotation" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                  </>
                )}
                {type === "sale-return" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                  </>
                )}
                {type === "purchase-return" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </>
                )}
              </select>
            </div>

            {!isEdit && (type === "sale" || type === "purchase") && (
              <div className="col-span-2 border-t border-border pt-4 mt-2">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Initial Payment (Optional)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="input-label">Payment Status</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => {
                        const next = e.target.value as "unpaid" | "paid" | "partial";
                        setPaymentStatus(next);
                        if (next === "paid") {
                          setPayingAmount(totals.grandTotal);
                          setReceivedAmount(totals.grandTotal);
                        } else if (next === "unpaid") {
                          setPayingAmount("");
                          setReceivedAmount("");
                        } else if (next === "partial" && !payingAmount) {
                          setPayingAmount(Math.round(totals.grandTotal / 2));
                        }
                      }}
                      className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
                    >
                      <option value="unpaid">Unpaid / Pending</option>
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>

                  {paymentStatus !== "unpaid" && (
                    <>
                      <div>
                        <label className="input-label">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
                        >
                          <option value="Cash">Cash</option>
                          <option value="credit card">Credit Card</option>
                          <option value="cheque">Cheque</option>
                          <option value="bank transfer">Bank Transfer</option>
                          <option value="Western Union">Western Union</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="input-label">Paying Amount ($)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={payingAmount}
                          onChange={(e) => setPayingAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder={String(totals.grandTotal)}
                          className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
                        />
                      </div>

                      <div>
                        <label className="input-label">Received Amount ($)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder={String(payingAmount || totals.grandTotal)}
                          className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
                        />
                      </div>

                      <div>
                        <label className="input-label">Change</label>
                        <div className="w-full h-10 px-3 bg-muted/40 border border-border rounded-lg text-sm flex items-center text-muted-foreground font-mono">
                          {formatCurrency(
                            receivedAmount !== "" && payingAmount !== "" && Number(receivedAmount) > Number(payingAmount)
                              ? Number(receivedAmount) - Number(payingAmount)
                              : 0
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="input-label">Payment Note</label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="Optional payment notes..."
                          className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h2 className="text-base font-semibold mb-4">Summary</h2>
          <div className="space-y-2 mb-4">
            <div className="detail-row">
              <span className="detail-label">Subtotal</span>
              <span className="detail-value">
                {formatCurrency(totals.detailTotal)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Order Tax</span>
              <span className="detail-value">
                {formatCurrency(totals.taxNet)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Shipping</span>
              <span className="detail-value">
                {formatCurrency(parseFloat(orderShipping as any) || 0)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Discount</span>
              <span className="detail-value text-destructive">
                -{formatCurrency(parseFloat(orderDiscount as any) || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 mt-2 border-t border-border">
              <span className="font-bold text-foreground">Grand Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save Transaction"
            )}
          </button>
        </div>
      </div>

      <div className="form-section">
        <h2 className="text-base font-semibold mb-4">Line Items</h2>
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or code..."
            className="form-input h-10 w-full pl-9"
            disabled={!warehouseId}
          />
          {!warehouseId && (
            <p className="text-xs text-warning mt-1">
              Please select a warehouse first
            </p>
          )}

          {/* Search Dropdown */}
          {search.length >= 2 && (
            <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-popover p-2 shadow-xl ring-1 ring-foreground/10 animate-scale-in">
              {searching ? (
                <div className="p-4 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching...
                </div>
              ) : products.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No products found
                </div>
              ) : (
                products.flatMap((product: any) =>
                  product.is_variant
                    ? product.variants
                        .filter((variant: any) => !variant.deletedAt)
                        .map((variant: any) => {
                          const stock =
                            product.stock_variants.find(
                              (row: any) =>
                                String(row.variant_id) === String(variant._id),
                            )?.current_stock ?? 0;
                          return (
                            <button
                              key={`${product._id}:${variant._id}`}
                              type="button"
                              onClick={() => addProduct(product, variant)}
                              className="group flex w-full items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-muted"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {product.name} — {variant.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {variant.code}
                                </p>
                              </div>
                              <div className="text-right text-xs">
                                <p>Stock: {stock}</p>
                                <Plus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          );
                        })
                    : [
                        <button
                          key={product._id}
                          type="button"
                          onClick={() => addProduct(product)}
                          className="group flex w-full items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-muted"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {product.code}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p>Stock: {product.current_stock}</p>
                            <Plus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>,
                      ],
                )
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-center w-24">Qty</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field: any, idx) => (
                <tr key={field.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <p className="font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.code}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      {...register(`details.${idx}.unit_price`, {
                        valueAsNumber: true,
                        onChange: (event) =>
                          updateLine(idx, {
                            ...watchDetails[idx],
                            unit_price: Number(event.target.value),
                          }),
                      })}
                      className="w-24 text-right h-8 bg-secondary border border-border rounded px-2"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        {...register(`details.${idx}.quantity`, {
                          valueAsNumber: true,
                          onChange: (event) =>
                            updateLine(idx, {
                              ...watchDetails[idx],
                              quantity: Number(event.target.value),
                            }),
                        })}
                        className="w-16 text-center h-8 bg-secondary border border-border rounded px-2"
                      />
                      {field.unit_name && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {field.unit_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        {...register(`details.${idx}.discount`, {
                          valueAsNumber: true,
                          onChange: (event) =>
                            updateLine(idx, {
                              ...watchDetails[idx],
                              discount: Number(event.target.value),
                            }),
                        })}
                        className="w-16 text-right h-8 bg-secondary border border-border rounded px-2"
                      />
                      <select
                        {...register(`details.${idx}.discount_method`, {
                          onChange: (event) =>
                            updateLine(idx, {
                              ...watchDetails[idx],
                              discount_method: event.target.value,
                            }),
                        })}
                        className="w-12 h-8 bg-secondary border border-border rounded px-1"
                      >
                        <option value="1">%</option>
                        <option value="2">$</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatCurrency(watchDetails[idx]?.tax_net || 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(watchDetails[idx]?.subtotal || 0)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="text-destructive/80 hover:text-destructive p-1 rounded hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {fields.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground text-sm"
                  >
                    No items added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10 sm:grid-cols-3">
          <div>
            <label className="input-label">Order Tax (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              {...register("tax_rate", { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg"
            />
          </div>
          <div>
            <label className="input-label">Discount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register("discount", { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg"
            />
          </div>
          <div>
            <label className="input-label">Shipping ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register("shipping", { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg"
            />
          </div>
        </div>
      </div>

      <QuickPersonModal
        open={quickPersonOpen}
        type={config.party}
        onClose={() => setQuickPersonOpen(false)}
        onCreated={(newPerson) => {
          setPeople((prev: any) => [...prev, newPerson]);
          setValue("people_id", newPerson._id);
        }}
      />
    </form>
  );
}
