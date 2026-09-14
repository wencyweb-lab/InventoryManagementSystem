"use client";
import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  Tag,
  ArrowLeft,
  Loader2,
  Maximize,
  UserPlus,
  Settings2,
} from "lucide-react";
import axios from "axios";
import { calcLine, calcGrandTotal } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  PosCheckoutDialog,
  PosReceipt,
  PosQuickCustomerModal,
  PosCartItemDetailModal,
} from "@/components/pos/CheckoutDialogs";
import { Logo } from "@/components/layout/Logo";
import { ModeToggle } from "@/components/layout/ModeToggle";

export default function PosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [clients, setClients] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tendered, setTendered] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [receipt, setReceipt] = useState<any>(null);
  const [posSettings, setPosSettings] = useState<any>({});
  const [systemSettings, setSystemSettings] = useState<any>({});

  // Modals state
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);

  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      axios.get("/api/categories?all=true"),
      axios.get("/api/brands?all=true"),
      axios.get("/api/clients?all=true"),
      axios.get("/api/warehouses?all=true"),
      axios.get("/api/settings/pos"),
      axios.get("/api/settings"),
    ]).then(([cats, brs, clis, whs, pos, system]) => {
      setCategories(cats.data);
      setBrands(brs.data);
      setClients(clis.data);
      setWarehouses(whs.data);
      const defaultWarehouse = system.data.warehouse_id?._id ?? system.data.warehouse_id;
      const defaultClient = system.data.client_id?._id ?? system.data.client_id;
      if (whs.data.length > 0) setSelectedWarehouse(defaultWarehouse || whs.data[0]._id);
      if (clis.data.length > 0) setSelectedClient(defaultClient || clis.data[0]._id);
      setPosSettings(pos.data);
      setSystemSettings(system.data);
    });
  }, []);

  // Fetch products when warehouse/category/brand/search changes
  useEffect(() => {
    if (!selectedWarehouse) return;
    const timer = setTimeout(() => {
      setLoading(true);
      axios
        .get(
          `/api/pos?warehouse_id=${selectedWarehouse}&category_id=${selectedCat}&brand_id=${selectedBrand}&search=${encodeURIComponent(search)}&limit=50`,
        )
        .then((res) => setProducts(res.data.data))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedWarehouse, selectedCat, selectedBrand, search]);

  const changeWarehouse = (warehouseId: string) => {
    if (cart.length && !confirm("Changing warehouse will clear the current cart. Continue?")) return;
    setCart([]);
    setSelectedWarehouse(warehouseId);
  };

  const addToCart = (
    product: any,
    variant?: any,
    availableStock = product.current_stock,
  ) => {
    if (availableStock <= 0) {
      toast.error("Out of stock!");
      return;
    }

    setCart((prev) => {
      const variantId = variant?._id ?? null;
      const existing = prev.findIndex(
        (item) =>
          item.product_id === product._id &&
          (item.variant_id ?? null) === variantId,
      );
      const newCart = [...prev];
      if (existing >= 0) {
        if (newCart[existing].quantity + 1 > availableStock) {
          toast.error("Not enough stock");
          return prev;
        }
        newCart[existing].quantity += 1;
      } else {
        newCart.push({
          product_id: product._id,
          variant_id: variantId,
          name: variant ? `${product.name} — ${variant.name}` : product.name,
          code: variant?.code ?? product.code,
          quantity: 1,
          unit_price: product.price,
          discount: 0,
          discount_method: "1",
          tax_method: product.tax_method || "1",
          tax_percent: product.TaxNet || 0,
          unit_id: product.sale_unit_id?._id || product.unit_id?._id,
          max_stock: availableStock,
        });
      }
      return recalculateCart(newCart);
    });
  };

  const updateQuantity = (idx: number, delta: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      const newQ = newCart[idx].quantity + delta;
      if (newQ <= 0) {
        newCart.splice(idx, 1);
      } else if (newQ > newCart[idx].max_stock) {
        toast.error("Not enough stock");
      } else {
        newCart[idx].quantity = newQ;
      }
      return recalculateCart(newCart);
    });
  };

  const recalculateCart = (cartItems: any[]) => {
    return cartItems.map((item) => {
      const calc = calcLine({
        unitPrice: item.unit_price,
        quantity: item.quantity,
        discount: item.discount,
        discountMethod: item.discount_method,
        taxRate: item.tax_percent,
        taxMethod: item.tax_method,
      });
      return {
        ...item,
        tax_net: calc.taxAmount,
        Net_price: calc.net,
        subtotal: calc.subtotal,
      };
    });
  };

  const handleSaveItemDetail = (updated: {
    unit_price: number;
    discount: number;
    discount_method: string;
    tax_percent: number;
    tax_method: string;
  }) => {
    if (editingCartItemIndex === null || !cart[editingCartItemIndex]) return;
    setCart((prev) => {
      const next = [...prev];
      next[editingCartItemIndex] = {
        ...next[editingCartItemIndex],
        unit_price: updated.unit_price,
        discount: updated.discount,
        discount_method: updated.discount_method,
        tax_percent: updated.tax_percent,
        tax_method: updated.tax_method,
      };
      return recalculateCart(next);
    });
    setEditingCartItemIndex(null);
    toast.success("Item details updated");
  };

  const totals = calcGrandTotal({
    lineSubtotals: cart.map((c) => c.subtotal),
    orderDiscount: discount,
    orderTaxRate: taxRate,
    shipping: shipping,
  });

  const productOptions = products.flatMap((product: any) =>
    product.is_variant
      ? product.variants
          .filter((variant: any) => !variant.deletedAt)
          .map((variant: any) => ({
            key: `${product._id}:${variant._id}`,
            product,
            variant,
            stock:
              product.stock_variants.find(
                (row: any) => String(row.variant_id) === String(variant._id),
              )?.current_stock ?? 0,
          }))
      : [
          {
            key: product._id,
            product,
            variant: null,
            stock: product.current_stock,
          },
        ],
  );

  const openCheckout = () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    if (!selectedClient) return toast.error("Select a customer");
    if (!selectedWarehouse) return toast.error("Select a warehouse");
    setTendered(totals.grandTotal);
    setPaymentOpen(true);
  };

  const completeCheckout = async () => {
    if (tendered + 0.005 < totals.grandTotal)
      return toast.error("Tendered amount is below the total");
    setCheckingOut(true);
    try {
      const receiptItems = cart.map((item) => ({ ...item }));
      const payload = {
        date: new Date().toISOString(),
        client_id: selectedClient,
        warehouse_id: selectedWarehouse,
        status: "completed",
        discount,
        tax_rate: taxRate,
        shipping,
        is_pos: true,
        payment_method: paymentMethod,
        tendered,
        payment_notes: paymentNotes,
        details: cart,
      };

      const response = await axios.post("/api/pos", payload);

      toast.success("Sale completed successfully!");
      setReceipt({
        ...response.data,
        items: receiptItems,
        total: totals.grandTotal,
        client: clients.find((client: any) => client._id === selectedClient),
      });
      setPaymentOpen(false);
      setCart([]);
      setDiscount(0);
      setTaxRate(0);
      setShipping(0);
      setPaymentNotes("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div
      className={`pos-shell flex h-screen w-full flex-col overflow-hidden bg-background animate-fade-in ${receipt ? "receipt-open" : ""}`}
    >
      {/* POS Topbar */}
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="button-outline w-9 px-0"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <Logo className="hidden sm:flex" />
          <div className="hidden h-5 w-px bg-border sm:block" />
          <h1 className="text-base font-semibold text-foreground">Point of Sale</h1>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 max-sm:basis-full">
          <select
            value={selectedWarehouse}
            onChange={(e) => changeWarehouse(e.target.value)}
            className="form-input min-w-0 flex-1 sm:w-44 sm:flex-none"
          >
            <option value="">Select Warehouse</option>
            {warehouses.map((w: any) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Customer select with quick add button */}
          <div className="flex items-center gap-1 min-w-0 flex-1 sm:w-56 sm:flex-none">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="form-input min-w-0 flex-1"
            >
              <option value="">Select Customer</option>
              {clients.map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setQuickCustomerOpen(true)}
              className="button-outline h-10 w-10 p-0 flex items-center justify-center shrink-0 text-primary hover:bg-primary/10"
              title="Quick Add Customer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          <ModeToggle />
          <button
            className="button-outline w-9 px-0"
            onClick={() => document.documentElement.requestFullscreen()}
          >
            <Maximize className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left: Product Grid */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 flex-col gap-3 border-b bg-card p-3 sm:flex-row sm:p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={async (event) => {
                  if (event.key !== "Enter") return;
                  const query = search.trim();
                  if (!query) return;
                  const exact = productOptions.find(
                    (option) =>
                      option.product.code?.toLowerCase() === query.toLowerCase() ||
                      option.variant?.code?.toLowerCase() === query.toLowerCase(),
                  );
                  if (exact) {
                    event.preventDefault();
                    addToCart(exact.product, exact.variant, exact.stock);
                    setSearch("");
                    return;
                  }

                  if (selectedWarehouse) {
                    event.preventDefault();
                    try {
                      const res = await axios.get(
                        `/api/pos?warehouse_id=${selectedWarehouse}&barcode=${encodeURIComponent(query)}`
                      );
                      const foundProducts = res.data?.data;
                      if (foundProducts && foundProducts.length > 0) {
                        const p = foundProducts[0];
                        const matchedVariant = p.variants?.find(
                          (v: any) => v.code?.toLowerCase() === query.toLowerCase()
                        );
                        if (matchedVariant) {
                          const vStock = p.stock_variants?.find(
                            (sv: any) => String(sv.variant_id) === String(matchedVariant._id)
                          )?.current_stock ?? 0;
                          addToCart(p, matchedVariant, vStock);
                        } else {
                          addToCart(p, undefined, p.current_stock);
                        }
                        setSearch("");
                      } else {
                        toast.error(`No product found with barcode "${query}"`);
                      }
                    } catch {
                      toast.error("Barcode lookup failed");
                    }
                  }
                }}
                placeholder="Search products by name or barcode..."
                className="form-input h-10 w-full pl-10"
              />
            </div>

            {/* Category & Brand Filters */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="form-input h-10 min-w-36 flex-1 sm:w-40 sm:flex-none"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="form-input h-10 min-w-36 flex-1 sm:w-40 sm:flex-none"
              >
                <option value="">All Brands</option>
                {brands.map((b: any) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/20 p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Tag className="w-12 h-12 mb-4 opacity-20" />
                <p>No products found matching the criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {productOptions.map(({ key, product: p, variant, stock }) => (
                  <button
                    key={key}
                    onClick={() => addToCart(p, variant, stock)}
                    disabled={stock <= 0}
                    className={`flex flex-col overflow-hidden rounded-xl bg-card text-left shadow-sm ring-1 transition-all duration-200 ${stock > 0 ? "ring-foreground/10 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20" : "cursor-not-allowed opacity-60 ring-destructive/30"}`}
                  >
                    <div className="aspect-square bg-secondary/50 relative">
                      {p.image !== "no-image.png" ? (
                        <img
                          src={`/uploads/products/${p.image}`}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tag className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      {stock <= 0 && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center font-bold text-destructive backdrop-blur-sm">
                          OUT OF STOCK
                        </div>
                      )}
                      {stock > 0 && (
                        <div className="absolute right-2 top-2 rounded-full border bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                          {stock}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-foreground text-sm line-clamp-2 leading-tight">
                        {p.name}
                        {variant ? ` — ${variant.name}` : ""}
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatCurrency(p.price)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="relative z-10 flex h-[48%] w-full shrink-0 flex-col bg-card lg:h-auto lg:w-[420px]">
          <div className="flex shrink-0 items-center gap-2 border-b p-4 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10"><ShoppingCart className="h-4 w-4 text-primary" /></span> Current Order
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <ShoppingCart className="w-8 h-8 opacity-40" />
                </div>
                <p>Cart is empty</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/10"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {item.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingCartItemIndex(idx)}
                        className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                        title="Edit line price, discount, or tax"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatCurrency(item.unit_price)}</span>
                      {item.discount > 0 && (
                        <span className="text-destructive font-medium">
                          Disc: {item.discount}{item.discount_method === "2" ? "%" : "$"}
                        </span>
                      )}
                      {item.tax_percent > 0 && (
                        <span className="text-primary font-medium">
                          Tax: {item.tax_percent}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-bold text-sm text-foreground">
                      {formatCurrency(item.subtotal)}
                    </p>
                    <div className="flex items-center bg-background rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Checkout */}
          <div className="shrink-0 border-t bg-card p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] sm:p-5">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal ({cart.length} items)</span>
                <span>{formatCurrency(totals.detailTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax</span>
                <span>{formatCurrency(totals.taxNet)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Discount</span>
                <span className="text-destructive">
                  -{formatCurrency(discount)}
                </span>
              </div>
            </div>

            <div className="mb-5 flex items-end justify-between">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="text-3xl font-semibold tracking-tight text-foreground">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>

            <button
              onClick={openCheckout}
              disabled={checkingOut || cart.length === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkingOut ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-6 h-6" /> Pay Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PosCheckoutDialog
        open={paymentOpen}
        total={totals.grandTotal}
        method={paymentMethod}
        tendered={tendered}
        notes={paymentNotes}
        loading={checkingOut}
        onMethod={setPaymentMethod}
        onTendered={setTendered}
        onNotes={setPaymentNotes}
        onClose={() => setPaymentOpen(false)}
        onConfirm={completeCheckout}
      />

      <PosReceipt
        receipt={receipt}
        posSettings={posSettings}
        systemSettings={systemSettings}
        onClose={() => setReceipt(null)}
      />

      <PosQuickCustomerModal
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        onCreated={(newCustomer) => {
          setClients((prev) => [...prev, newCustomer]);
          setSelectedClient(newCustomer._id);
        }}
      />

      <PosCartItemDetailModal
        open={editingCartItemIndex !== null}
        item={editingCartItemIndex !== null ? cart[editingCartItemIndex] : null}
        onClose={() => setEditingCartItemIndex(null)}
        onSave={handleSaveItemDetail}
      />
    </div>
  );
}
