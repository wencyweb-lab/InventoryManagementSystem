"use client";
import Link from "next/link";
import { ArrowLeft, Printer, Search, Trash2, RotateCcw, Plus, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import JsBarcode from "jsbarcode";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

type PaperStyle =
  | "style40"
  | "style30"
  | "style24"
  | "style20"
  | "style18"
  | "style14"
  | "style12"
  | "style10"
  | "styleroll";

interface PaperOption {
  value: PaperStyle;
  label: string;
  isA4: boolean;
  perSheet: number;
}

const PAPER_OPTIONS: PaperOption[] = [
  { value: "style40", label: "40 per sheet (A4) (1.799\" x 1.003\")", isA4: true, perSheet: 40 },
  { value: "style30", label: "30 per sheet (Letter) (2.625\" x 1\")", isA4: false, perSheet: 30 },
  { value: "style24", label: "24 per sheet (A4) (2.48\" x 1.334\")", isA4: true, perSheet: 24 },
  { value: "style20", label: "20 per sheet (4\" x 1\")", isA4: false, perSheet: 20 },
  { value: "style18", label: "18 per sheet (A4) (2.5\" x 1.835\")", isA4: true, perSheet: 18 },
  { value: "style14", label: "14 per sheet (4\" x 1.33\")", isA4: false, perSheet: 14 },
  { value: "style12", label: "12 per sheet (A4) (2.5\" x 2.834\")", isA4: true, perSheet: 12 },
  { value: "style10", label: "10 per sheet (4\" x 2\")", isA4: false, perSheet: 10 },
  { value: "styleroll", label: "Continuous Feed / Thermal Roll (50mm x 30mm)", isA4: false, perSheet: 1 },
];

interface QueueItem {
  product: any;
  quantity: number;
}

function BarcodeLabelItem({
  product,
  showName,
  showPrice,
  showCode,
  paperStyle,
}: {
  product: any;
  showName: boolean;
  showPrice: boolean;
  showCode: boolean;
  paperStyle: PaperStyle;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !product.code) return;
    const format =
      product.barcode_symbology === "UPCA" ? "UPC" : (product.barcode_symbology || "CODE128");

    const isSmall = paperStyle === "style40" || paperStyle === "style30";
    const barWidth = isSmall ? 1.1 : 1.4;
    const barHeight = isSmall ? 22 : 30;

    try {
      JsBarcode(ref.current, String(product.code), {
        format,
        width: barWidth,
        height: barHeight,
        displayValue: showCode,
        fontSize: isSmall ? 9 : 11,
        margin: 1,
      });
    } catch {
      try {
        JsBarcode(ref.current, String(product.code), {
          format: "CODE128",
          width: barWidth,
          height: barHeight,
          displayValue: showCode,
          fontSize: isSmall ? 9 : 11,
          margin: 1,
        });
      } catch (e) {
        // In case of invalid barcode string
      }
    }
  }, [product.code, product.barcode_symbology, showCode, paperStyle]);

  return (
    <div className={`barcode-item ${paperStyle}`}>
      {showName && (
        <span className="barcode-name font-semibold text-foreground truncate max-w-full px-1">
          {product.name}
        </span>
      )}
      <svg ref={ref} className="barcode-svg" />
      {showPrice && (
        <span className="barcode-price font-bold text-foreground">
          {formatCurrency(product.price)}
        </span>
      )}
    </div>
  );
}

export default function BarcodePage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [productsList, setProductsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // Paper & display settings
  const [paperStyle, setPaperStyle] = useState<PaperStyle>("style24");
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCode, setShowCode] = useState(true);

  // Load warehouses & products
  useEffect(() => {
    Promise.all([
      axios.get("/api/warehouses?all=true"),
      axios.get("/api/products?limit=100"),
    ]).then(([whRes, prodRes]) => {
      setWarehouses(whRes.data || []);
      setProductsList(prodRes.data?.data || []);
    }).catch(() => undefined);
  }, []);

  // Prepopulate if id query param exists
  useEffect(() => {
    if (!initialId) return;
    axios.get(`/api/products/${initialId}`).then(({ data }) => {
      if (data?.product) {
        setQueue([{ product: data.product, quantity: 10 }]);
      }
    }).catch(() => undefined);
  }, [initialId]);

  // When warehouse changes, re-fetch products scoped to warehouse
  useEffect(() => {
    const url = selectedWarehouse
      ? `/api/products?warehouse_id=${selectedWarehouse}&limit=100`
      : `/api/products?limit=100`;
    axios.get(url).then((res) => {
      setProductsList(res.data?.data || []);
    }).catch(() => undefined);
  }, [selectedWarehouse]);

  // Autocomplete matching
  const searchMatches = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return productsList.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [searchTerm, productsList]);

  // Add product to queue
  const addProductToQueue = (product: any) => {
    setQueue((prev) => {
      const idx = prev.findIndex((item) => item.product._id === product._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 10;
        return next;
      }
      return [...prev, { product, quantity: 10 }];
    });
    setSearchTerm("");
    setSearchFocused(false);
  };

  const updateQuantity = (idx: number, qty: number) => {
    setQueue((prev) => {
      const next = [...prev];
      next[idx].quantity = Math.max(1, qty);
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetAll = () => {
    setQueue([]);
    setSearchTerm("");
    toast.success("Print queue cleared");
  };

  // Flatten queue into individual label items
  const allLabels = useMemo(() => {
    const list: any[] = [];
    queue.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        list.push(item.product);
      }
    });
    return list;
  }, [queue]);

  const selectedPaper = PAPER_OPTIONS.find((p) => p.value === paperStyle) || PAPER_OPTIONS[2];

  // Group labels into pages based on perSheet
  const pages = useMemo(() => {
    if (paperStyle === "styleroll") {
      return [allLabels];
    }
    const perPage = selectedPaper.perSheet;
    const result: any[][] = [];
    for (let i = 0; i < allLabels.length; i += perPage) {
      result.push(allLabels.slice(i, i + perPage));
    }
    return result;
  }, [allLabels, selectedPaper, paperStyle]);

  const pageContainerClass =
    paperStyle === "styleroll"
      ? "barcode-roll"
      : selectedPaper.isA4
      ? "barcodea4"
      : "barcode_non_a4";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Top Header */}
      <div className="page-header print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/products" className="table-action-btn">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="page-title">Print Barcodes</h1>
            <p className="page-description">
              Generate & print standard barcode sheets across 9 paper layouts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            disabled={queue.length === 0}
            className="button-outline flex items-center gap-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            onClick={() => window.print()}
            disabled={allLabels.length === 0}
            className="button-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Print Barcodes ({allLabels.length})
          </button>
        </div>
      </div>

      {/* Controls & Search Card */}
      <div className="grid gap-6 lg:grid-cols-3 print:hidden">
        {/* Left: Product Search & Warehouse */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">Filter by Warehouse (Optional)</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="form-input w-full"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="input-label">Search & Add Product</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Scan barcode or type name/code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  className="form-input w-full pl-9"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {searchFocused && searchMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg ring-1 ring-border">
                  {searchMatches.map((prod) => (
                    <button
                      key={prod._id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addProductToQueue(prod);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm rounded-md hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{prod.name}</p>
                        <p className="text-xs text-muted-foreground">Code: {prod.code}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-primary">{formatCurrency(prod.price)}</span>
                        <span className="block text-[11px] text-muted-foreground">{prod.barcode_symbology || "CODE128"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Queue Table */}
          <div className="mt-4 border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Product</th>
                  <th className="px-4 py-2.5 text-left">Code</th>
                  <th className="px-4 py-2.5 text-left">Symbology</th>
                  <th className="px-4 py-2.5 text-center w-28">Quantity</th>
                  <th className="px-4 py-2.5 text-right w-16">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No products in print queue. Search above or click print on any product.
                    </td>
                  </tr>
                ) : (
                  queue.map((item, idx) => (
                    <tr key={item.product._id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {item.product.name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                        {item.product.code}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {item.product.barcode_symbology || "CODE128"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                          className="form-input h-8 w-20 text-center mx-auto"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => removeItem(idx)}
                          className="table-action-btn text-destructive hover:bg-destructive/10"
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
        </div>

        {/* Right: Paper Layout & Display Options */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-foreground">Print Options</h2>

          <div>
            <label className="input-label">Paper Size Layout</label>
            <select
              value={paperStyle}
              onChange={(e) => setPaperStyle(e.target.value as PaperStyle)}
              className="form-input w-full"
            >
              {PAPER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Label Contents</p>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              Show Product Name
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              Show Price
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={showCode}
                onChange={(e) => setShowCode(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              Show Barcode Code Text
            </label>
          </div>

          <div className="rounded-lg bg-primary/10 p-3 text-xs text-primary space-y-1">
            <p className="font-semibold">Summary:</p>
            <p>{queue.length} product(s) in queue</p>
            <p><strong>{allLabels.length}</strong> total labels across <strong>{pages.length}</strong> sheet(s)</p>
          </div>
        </div>
      </div>

      {/* Barcode Print Sheet Preview Area */}
      <div id="print_barcode_area" className="mt-8">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Sheet Preview ({selectedPaper.label})
          </h2>
          <span className="text-xs text-muted-foreground">
            {pages.length} sheet{pages.length !== 1 ? "s" : ""} to print
          </span>
        </div>

        {pages.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground print:hidden">
            Add products above to preview barcode labels.
          </div>
        ) : (
          pages.map((pageLabels, pageIdx) => (
            <div key={pageIdx} className={pageContainerClass}>
              {pageLabels.map((prod, labelIdx) => (
                <BarcodeLabelItem
                  key={`${prod._id}-${labelIdx}`}
                  product={prod}
                  showName={showName}
                  showPrice={showPrice}
                  showCode={showCode}
                  paperStyle={paperStyle}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Embedded Barcode & Print Styles */}
      <style jsx global>{`
        .barcodea4 {
          width: 8.25in;
          min-height: 11.6in;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          border: 1px solid #e2e8f0;
          margin: 16px auto;
          padding: 0.1in 0 0 0.1in;
          page-break-after: always;
          background: #ffffff;
          box-sizing: border-box;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .barcode_non_a4 {
          width: 8.45in;
          min-height: 10.3in;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          border: 1px solid #e2e8f0;
          margin: 16px auto;
          padding-top: 0.1in;
          page-break-after: always;
          background: #ffffff;
          box-sizing: border-box;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .barcode-roll {
          width: 2.4in;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid #e2e8f0;
          margin: 16px auto;
          padding: 0.1in;
          background: #ffffff;
          box-sizing: border-box;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .barcode-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          text-align: center;
          border: 1px dotted #cbd5e1;
          font-size: 11px;
          line-height: 13px;
          text-transform: uppercase;
          box-sizing: border-box;
          padding: 2px 4px;
          color: #0f172a;
          background: #ffffff;
        }

        .barcode-item .barcode-name {
          display: block;
          font-size: 10px;
          line-height: 12px;
          margin-bottom: 2px;
        }

        .barcode-item .barcode-price {
          display: block;
          font-size: 11px;
          font-weight: bold;
          margin-top: 1px;
        }

        .barcode-svg {
          max-width: 100%;
          height: auto;
          margin: 0 auto;
        }

        /* 9 Specific Preset Dimensions */
        .style40 {
          width: 1.799in;
          height: 1.003in;
          margin: 0 0.07in 0.05in 0;
          font-size: 9px;
        }
        .style40 .barcode-name {
          font-size: 8px;
        }
        .style40 .barcode-price {
          font-size: 9px;
        }

        .style30 {
          width: 2.625in;
          height: 1in;
          margin: 0 0.07in 0.05in 0;
        }

        .style24 {
          width: 2.48in;
          height: 1.335in;
          margin: 0 0.079in 0.05in 0;
        }

        .style20 {
          width: 4in;
          height: 1in;
          margin: 0 0.1in 0.05in 0;
        }

        .style18 {
          width: 2.5in;
          height: 1.835in;
          margin: 0 0.079in 0.05in 0;
        }

        .style14 {
          width: 4in;
          height: 1.33in;
          margin: 0 0.1in 0.05in 0;
        }

        .style12 {
          width: 2.5in;
          height: 2.834in;
          margin: 0 0.079in 0.05in 0;
        }

        .style10 {
          width: 4in;
          height: 2in;
          margin: 0 0.1in 0.05in 0;
        }

        .styleroll {
          width: 2in;
          height: 1.2in;
          margin: 0.05in 0;
          page-break-after: always;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #print_barcode_area,
          #print_barcode_area * {
            visibility: visible;
          }
          #print_barcode_area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .barcodea4,
          .barcode_non_a4,
          .barcode-roll {
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
          }
          .barcode-item {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
