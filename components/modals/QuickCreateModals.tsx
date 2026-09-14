"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Loader2, Plus, X } from "lucide-react";

export function QuickPersonModal({
  open,
  type,
  onClose,
  onCreated,
}: {
  open: boolean;
  type: "client" | "provider";
  onClose: () => void;
  onCreated: (person: any) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const isSupplier = type === "provider";
  const title = isSupplier ? "Quick Add Supplier" : "Quick Add Customer";
  const endpoint = isSupplier ? "/api/providers" : "/api/clients";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");

    setLoading(true);
    try {
      const res = await axios.post(endpoint, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
      });
      const created = res.data?.data || res.data;
      toast.success(`${isSupplier ? "Supplier" : "Customer"} created successfully`);
      onCreated(created);
      onClose();
      setName("");
      setPhone("");
      setEmail("");
      setCity("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Creation failed");
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
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="input-label">Name *</label>
          <input
            type="text"
            required
            placeholder={isSupplier ? "Supplier / Company Name" : "Customer Full Name"}
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
              placeholder="contact@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input w-full"
            />
          </div>
        </div>

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

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="button-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function QuickCategoryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (category: any) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Category name is required");

    setLoading(true);
    try {
      const res = await axios.post("/api/categories", {
        name: name.trim(),
        code: code.trim() || undefined,
      });
      const created = res.data?.data || res.data;
      toast.success("Category created successfully");
      onCreated(created);
      onClose();
      setName("");
      setCode("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Add Category</h2>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="input-label">Category Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Beverages"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div>
          <label className="input-label">Category Code</label>
          <input
            type="text"
            placeholder="e.g. BEV (generated if empty)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="button-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function QuickBrandModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (brand: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Brand name is required");

    setLoading(true);
    try {
      const res = await axios.post("/api/brands", {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const created = res.data?.data || res.data;
      toast.success("Brand created successfully");
      onCreated(created);
      onClose();
      setName("");
      setDescription("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create brand");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Add Brand</h2>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="input-label">Brand Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Apple, Nike"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div>
          <label className="input-label">Description</label>
          <input
            type="text"
            placeholder="Optional brand description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="button-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function QuickUnitModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (unit: any) => void;
}) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Unit name is required");
    if (!shortName.trim()) return toast.error("Short name is required");

    setLoading(true);
    try {
      const res = await axios.post("/api/units", {
        name: name.trim(),
        short_name: shortName.trim(),
        base_unit: null,
        operator: "*",
        operator_value: 1,
      });
      const created = res.data?.data || res.data;
      toast.success("Unit created successfully");
      onCreated(created);
      onClose();
      setName("");
      setShortName("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create unit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[1px]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Add Unit</h2>
          <button type="button" onClick={onClose} className="table-action-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="input-label">Unit Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Kilogram, Piece"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div>
          <label className="input-label">Short Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. kg, pc"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="form-input w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="button-outline">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="button-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
