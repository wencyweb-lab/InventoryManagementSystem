"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { ArrowLeft, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import {
  QuickCategoryModal,
  QuickBrandModal,
  QuickUnitModal,
} from "@/components/modals/QuickCreateModals";

const id = (value: any) => value?._id ?? value ?? "";
const list = (response: any) =>
  Array.isArray(response) ? response : (response?.data ?? []);

export function ProductForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickBrandOpen, setQuickBrandOpen] = useState(false);
  const [quickUnitOpen, setQuickUnitOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: initialData?.name ?? "",
    code: initialData?.code ?? "",
    barcode_symbology: initialData?.barcode_symbology ?? "CODE128",
    category_id: id(initialData?.category_id),
    brand_id: id(initialData?.brand_id),
    unit_id: id(initialData?.unit_id),
    sale_unit_id: id(initialData?.sale_unit_id),
    purchase_unit_id: id(initialData?.purchase_unit_id),
    cost: initialData?.cost ?? 0,
    price: initialData?.price ?? 0,
    tax_method: initialData?.tax_method ?? "1",
    TaxNet: initialData?.TaxNet ?? 0,
    has_alert: initialData?.has_alert ?? false,
    alert_quantity: initialData?.alert_quantity ?? 0,
    is_variant: initialData?.is_variant ?? false,
    variants: (initialData?.variants ?? [])
      .filter((variant: any) => !variant.deletedAt)
      .map((variant: any) => ({
        _id: variant._id,
        name: variant.name,
        code: variant.code,
      })),
    note: initialData?.note ?? "",
    image: initialData?.image ?? "no-image.png",
    images: initialData?.images ?? [],
  });

  useEffect(() => {
    Promise.all([
      axios.get("/api/categories?all=true"),
      axios.get("/api/brands?all=true"),
      axios.get("/api/units?all=true"),
    ])
      .then(([categoryResponse, brandResponse, unitResponse]) => {
        setCategories(list(categoryResponse.data));
        setBrands(list(brandResponse.data));
        setUnits(list(unitResponse.data));
      })
      .catch(() => toast.error("Unable to load product form options"));
  }, []);

  function field(name: string, value: unknown) {
    setForm((current: any) => ({ ...current, [name]: value }));
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const data = new FormData();
      Array.from(files)
        .slice(0, 5)
        .forEach((file) => data.append("files", file));
      const response = await axios.post("/api/uploads/products", data);
      const uploaded: string[] = response.data.files;
      setForm((current: any) => ({
        ...current,
        image: uploaded[0] ?? current.image,
        images: [
          ...new Set<string>([...(current.images ?? []), ...uploaded]),
        ].slice(0, 20),
      }));
      toast.success(
        `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded`,
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.is_variant) {
      if (!form.variants || form.variants.length === 0) {
        toast.error("Please add at least one variant");
        return;
      }
      const codes = form.variants.map((v: any) => v.code?.trim());
      if (codes.some((c: string) => !c)) {
        toast.error("All variants must have a code/barcode");
        return;
      }
      if (new Set(codes).size !== codes.length) {
        toast.error("Variant barcodes must be unique");
        return;
      }
      if (form.code && codes.includes(form.code.trim())) {
        toast.error("Variant barcode cannot be the same as the product code");
        return;
      }
    }
    setLoading(true);
    try {
      if (initialData?._id)
        await axios.put(`/api/products/${initialData._id}`, form);
      else await axios.post("/api/products", form);
      toast.success(`Product ${initialData ? "updated" : "created"}`);
      router.push("/dashboard/products");
      router.refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Unable to save product");
    } finally {
      setLoading(false);
    }
  }

  const compatibleUnits = units.filter(
    (unit) =>
      !form.unit_id ||
      unit._id === form.unit_id ||
      id(unit.base_unit) === form.unit_id,
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="form-section">
        <h2 className="mb-4 text-lg font-semibold">Product details</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="input-label">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">SKU/code</label>
            <input
              value={form.code}
              onChange={(e) => field("code", e.target.value)}
              placeholder="Generated if empty"
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Barcode symbology *</label>
            <select
              value={form.barcode_symbology}
              onChange={(e) => field("barcode_symbology", e.target.value)}
              className="form-input w-full"
            >
              <option>CODE128</option>
              <option>CODE39</option>
              <option>UPCA</option>
              <option>EAN13</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Category</label>
              <button
                type="button"
                onClick={() => setQuickCategoryOpen(true)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Quick Add
              </button>
            </div>
            <select
              value={form.category_id}
              onChange={(e) => field("category_id", e.target.value)}
              className="form-input w-full"
            >
              <option value="">No category</option>
              {categories.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Brand</label>
              <button
                type="button"
                onClick={() => setQuickBrandOpen(true)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Quick Add
              </button>
            </div>
            <select
              value={form.brand_id}
              onChange={(e) => field("brand_id", e.target.value)}
              className="form-input w-full"
            >
              <option value="">No brand</option>
              {brands.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Base unit *</label>
              <button
                type="button"
                onClick={() => setQuickUnitOpen(true)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Quick Add
              </button>
            </div>
            <select
              required
              value={form.unit_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  unit_id: e.target.value,
                  sale_unit_id: e.target.value,
                  purchase_unit_id: e.target.value,
                })
              }
              className="form-input w-full"
            >
              <option value="">Select unit</option>
              {units
                .filter((unit) => !unit.base_unit)
                .map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="input-label">Sale unit</label>
            <select
              value={form.sale_unit_id}
              onChange={(e) => field("sale_unit_id", e.target.value)}
              className="form-input w-full"
            >
              <option value="">Use base unit</option>
              {compatibleUnits.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Purchase unit</label>
            <select
              value={form.purchase_unit_id}
              onChange={(e) => field("purchase_unit_id", e.target.value)}
              className="form-input w-full"
            >
              <option value="">Use base unit</option>
              {compatibleUnits.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Cost *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) => field("cost", Number(e.target.value))}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Sale price *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => field("price", Number(e.target.value))}
              className="form-input w-full"
            />
          </div>
          <div>
            <label className="input-label">Tax method</label>
            <select
              value={form.tax_method}
              onChange={(e) => field("tax_method", e.target.value)}
              className="form-input w-full"
            >
              <option value="1">Exclusive</option>
              <option value="2">Inclusive</option>
            </select>
          </div>
          <div>
            <label className="input-label">Tax rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.TaxNet}
              onChange={(e) => field("TaxNet", Number(e.target.value))}
              className="form-input w-full"
            />
          </div>
        </div>
        <div className="mt-5">
          <label className="input-label">Notes</label>
          <textarea
            value={form.note}
            onChange={(e) => field("note", e.target.value)}
            className="form-input min-h-24 w-full"
          />
        </div>
        <div className="mt-5">
          <label className="input-label">Product images</label>
          <div className="flex flex-wrap items-center gap-3">
            {form.images.map((image: string) => (
              <div
                key={image}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border"
              >
                <img
                  src={`/uploads/products/${image}`}
                  alt="Product"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() =>
                    setForm((current: any) => {
                      const images = current.images.filter(
                        (item: string) => item !== image,
                      );
                      return {
                        ...current,
                        images,
                        image:
                          current.image === image
                            ? (images[0] ?? "no-image.png")
                            : current.image,
                      };
                    })
                  }
                  className="absolute right-1 top-1 rounded bg-background/90 p-1 text-destructive opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary">
              <ImagePlus className="mb-1 h-5 w-5" />
              {uploading ? "Uploading…" : "Add images"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={(event) => uploadImages(event.target.files)}
                className="hidden"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            JPEG, PNG, or WebP; 5 MB per image and up to 5 at once.
          </p>
        </div>
      </div>

      <div className="form-section grid gap-6 md:grid-cols-2">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.has_alert}
              onChange={(e) => field("has_alert", e.target.checked)}
            />{" "}
            Enable low-stock alert
          </label>
          {form.has_alert && (
            <div className="mt-3">
              <label className="input-label">Alert quantity (base unit)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.alert_quantity}
                onChange={(e) =>
                  field("alert_quantity", Number(e.target.value))
                }
                className="form-input w-full"
              />
            </div>
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.is_variant}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_variant: e.target.checked,
                  variants: e.target.checked ? form.variants : [],
                })
              }
            />{" "}
            Product has variants
          </label>
        </div>
        {form.is_variant && (
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="input-label">Variants</label>
              <button
                type="button"
                onClick={() =>
                  field("variants", [...form.variants, { name: "", code: "" }])
                }
                className="flex items-center gap-1 text-sm text-primary"
              >
                <Plus className="h-4 w-4" /> Add variant
              </button>
            </div>
            {form.variants.map((variant: any, index: number) => (
              <div
                key={variant._id ?? index}
                className="grid grid-cols-[1fr_1fr_36px] gap-2"
              >
                <input
                  required
                  value={variant.name}
                  onChange={(e) =>
                    field(
                      "variants",
                      form.variants.map((item: any, i: number) =>
                        i === index ? { ...item, name: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Variant name"
                  className="form-input"
                />
                <input
                  required
                  value={variant.code}
                  onChange={(e) =>
                    field(
                      "variants",
                      form.variants.map((item: any, i: number) =>
                        i === index ? { ...item, code: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Variant code"
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={() =>
                    field(
                      "variants",
                      form.variants.filter((_: any, i: number) => i !== index),
                    )
                  }
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg border px-5 py-2.5"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel
        </button>
        <button
          disabled={loading || uploading}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
        >
          <Save className="h-4 w-4" /> {loading ? "Saving…" : "Save Product"}
        </button>
      </div>

      <QuickCategoryModal
        open={quickCategoryOpen}
        onClose={() => setQuickCategoryOpen(false)}
        onCreated={(newCat) => {
          setCategories((prev) => [...prev, newCat]);
          field("category_id", newCat._id);
        }}
      />

      <QuickBrandModal
        open={quickBrandOpen}
        onClose={() => setQuickBrandOpen(false)}
        onCreated={(newBrand) => {
          setBrands((prev) => [...prev, newBrand]);
          field("brand_id", newBrand._id);
        }}
      />

      <QuickUnitModal
        open={quickUnitOpen}
        onClose={() => setQuickUnitOpen(false)}
        onCreated={(newUnit) => {
          setUnits((prev) => [...prev, newUnit]);
          setForm((prev: any) => ({
            ...prev,
            unit_id: newUnit._id,
            sale_unit_id: newUnit._id,
            purchase_unit_id: newUnit._id,
          }));
        }}
      />
    </form>
  );
}
