"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { KeyRound, Loader2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { ImageUploadField } from "@/components/shared/ImageUploadField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const [form, setForm] = useState<any>();
  const [saving, setSaving] = useState(false);
  useEffect(() => { axios.get("/api/profile").then(({ data }) => setForm({ name: data.name, email: data.email, phone: data.phone ?? "", avatar: data.avatar ?? "avatar-default.png", current_password: "", password: "" })); }, []);
  if (!form) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await axios.put("/api/profile", form); setForm({ ...form, current_password: "", password: "" }); toast.success("Profile saved"); }
    catch (error: any) { toast.error(error.response?.data?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">My profile</h1><p className="page-description">Manage your personal details, avatar and account password.</p></div><span className="badge-success gap-1.5"><ShieldCheck className="h-3 w-3" /> Active account</span></div>
      <form onSubmit={save} className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:sticky lg:top-20"><CardHeader className="items-center text-center"><span className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">{form.name?.[0]?.toUpperCase() ?? "U"}</span><CardTitle className="text-lg font-semibold">{form.name}</CardTitle><p className="text-sm text-muted-foreground">{form.email}</p></CardHeader><CardContent className="space-y-4"><div className="h-px bg-border" /><ImageUploadField kind="avatars" label="Profile image" value={form.avatar} onChange={(avatar) => setForm({ ...form, avatar })} /><div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{form.email}</p>{form.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{form.phone}</p>}</div></CardContent></Card>
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-semibold"><UserRound className="h-5 w-5" />Personal information</CardTitle><p className="text-sm text-muted-foreground">Your display and contact information.</p></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><label className="input-label">Name</label><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="form-input w-full" /></div><div><label className="input-label">Email</label><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="form-input w-full" /></div><div className="md:col-span-2"><label className="input-label">Phone</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="form-input w-full" /></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5" />Password</CardTitle><p className="text-sm text-muted-foreground">Leave both fields empty when you do not want to change it.</p></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><label className="input-label">Current password</label><input type="password" value={form.current_password} onChange={(event) => setForm({ ...form, current_password: event.target.value })} className="form-input w-full" /></div><div><label className="input-label">New password</label><input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="form-input w-full" /></div></CardContent></Card>
          <div className="flex justify-end"><Button type="submit" size="lg" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{saving ? "Saving…" : "Save profile"}</Button></div>
        </div>
      </form>
    </div>
  );
}
