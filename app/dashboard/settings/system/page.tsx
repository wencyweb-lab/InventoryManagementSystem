"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

export default function SystemSettingsPage() {
  const [form, setForm] = useState<any>();
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      axios.get("/api/settings"),
      axios.get("/api/currencies?all=true"),
      axios.get("/api/clients?all=true"),
      axios.get("/api/warehouses?all=true"),
    ]).then(([settings, currencyList, clientList, warehouseList]) => {
      const data = settings.data;
      setForm({
        CompanyName: data.CompanyName ?? "Stocky",
        CompanyPhone: data.CompanyPhone ?? "",
        CompanyAdress: data.CompanyAdress ?? "",
        email: data.email ?? "",
        logo: data.logo ?? "logo-default.png",
        footer: data.footer ?? "",
        developed_by: data.developed_by ?? "",
        currency_id: data.currency_id?._id ?? data.currency_id ?? "",
        client_id: data.client_id?._id ?? data.client_id ?? "",
        warehouse_id: data.warehouse_id?._id ?? data.warehouse_id ?? "",
        default_language: data.default_language ?? "en",
      });
      setCurrencies(currencyList.data);
      setClients(clientList.data);
      setWarehouses(warehouseList.data);
    });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await axios.put("/api/settings", form);
      toast.success("System settings saved");
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Save failed");
    }
  }

  if (!form) return <div>Loading…</div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company identity and application defaults
        </p>
      </div>
      <form
        onSubmit={save}
        className="form-section grid max-w-4xl gap-5 md:grid-cols-2"
      >
        <div>
          <label className="input-label">Company name</label>
          <input
            required
            value={form.CompanyName}
            onChange={(e) => setForm({ ...form, CompanyName: e.target.value })}
            className="form-input w-full"
          />
        </div>
        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="form-input w-full"
          />
        </div>
        <div>
          <label className="input-label">Phone</label>
          <input
            value={form.CompanyPhone}
            onChange={(e) => setForm({ ...form, CompanyPhone: e.target.value })}
            className="form-input w-full"
          />
        </div>
        <ImageUploadField
          kind="logos"
          label="Company logo"
          value={form.logo}
          onChange={(logo) => setForm({ ...form, logo })}
        />
        <div className="md:col-span-2">
          <label className="input-label">Address</label>
          <textarea
            value={form.CompanyAdress}
            onChange={(e) =>
              setForm({ ...form, CompanyAdress: e.target.value })
            }
            className="form-input min-h-20 w-full"
          />
        </div>
        <div>
          <label className="input-label">Currency</label>
          <select
            value={form.currency_id}
            onChange={(e) => setForm({ ...form, currency_id: e.target.value })}
            className="form-input w-full"
          >
            <option value="">Select</option>
            {currencies.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} ({item.symbol})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Default customer</label>
          <select
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            className="form-input w-full"
          >
            <option value="">Select</option>
            {clients.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Default warehouse</label>
          <select
            value={form.warehouse_id}
            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
            className="form-input w-full"
          >
            <option value="">Select</option>
            {warehouses.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Language code</label>
          <input
            value={form.default_language}
            onChange={(e) =>
              setForm({ ...form, default_language: e.target.value })
            }
            className="form-input w-full"
          />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">Footer</label>
          <input
            value={form.footer}
            onChange={(e) => setForm({ ...form, footer: e.target.value })}
            className="form-input w-full"
          />
        </div>
        <div>
          <label className="input-label">Developed by</label>
          <input
            value={form.developed_by}
            onChange={(e) => setForm({ ...form, developed_by: e.target.value })}
            className="form-input w-full"
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
            Save Settings
          </button>
        </div>
      </form>

      {/* System Diagnostics */}
      <SystemInfo />
    </div>
  );
}

function SystemInfo() {
  const [info, setInfo] = useState<any>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    axios.get('/api/admin/clear-cache').then(({ data }) => setInfo(data)).catch(() => null)
  }, [])

  async function clearCache() {
    setClearing(true)
    try {
      const { data } = await axios.post('/api/admin/clear-cache')
      toast.success(data.message)
      // Refresh diagnostics
      const refreshed = await axios.get('/api/admin/clear-cache')
      setInfo(refreshed.data)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Cache clear failed')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="form-section space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">System Diagnostics</h2>
          <p className="text-sm text-muted-foreground">Database status and application health</p>
        </div>
        <button
          onClick={clearCache}
          disabled={clearing}
          className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/20 transition-colors disabled:opacity-50"
        >
          {clearing ? 'Clearing…' : 'Clear Cache'}
        </button>
      </div>
      {info && (
        <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm">
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground mb-1">Database</dt>
            <dd className="font-medium">{info.dbName ?? '—'}</dd>
            <dd className={`text-xs mt-0.5 ${info.dbState === 'connected' ? 'text-success' : 'text-warning'}`}>{info.dbState}</dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground mb-1">Uptime</dt>
            <dd className="font-medium">{Math.floor((info.uptime ?? 0) / 60)} min {Math.round((info.uptime ?? 0) % 60)} sec</dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground mb-1">Node.js</dt>
            <dd className="font-medium">{info.nodeVersion}</dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground mb-1">Heap used</dt>
            <dd className="font-medium">{Math.round((info.memoryUsage?.heapUsed ?? 0) / 1024 / 1024)} MB</dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground mb-1">Registered models</dt>
            <dd className="font-medium">{info.models?.length ?? 0}</dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground mb-1">Last checked</dt>
            <dd className="font-medium">{info.timestamp ? new Date(info.timestamp).toLocaleTimeString() : '—'}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
