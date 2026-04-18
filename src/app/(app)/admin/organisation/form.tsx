"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Organisation } from "@/types/database";
import { updateOrganisation } from "./actions";

export function OrgSettings({ org }: { org: Organisation }) {
  const [form, setForm] = useState({
    name: org.name,
    slug: org.slug,
    domain: org.domain ?? "",
    brand_primary: org.brand_primary ?? "#b87d07",
    region: org.region ?? "ap-southeast-1",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateOrganisation({ id: org.id, ...form });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  const u = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={save} className="card max-w-2xl">
      <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Organisation name</label>
          <input className="input" value={form.name} onChange={(e) => u("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Slug</label>
          <input className="input" value={form.slug} onChange={(e) => u("slug", e.target.value)} />
        </div>
        <div>
          <label className="label">Email domain</label>
          <input className="input" placeholder="jcorp.my" value={form.domain} onChange={(e) => u("domain", e.target.value)} />
        </div>
        <div>
          <label className="label">Primary brand colour</label>
          <input type="color" className="input h-10 p-1" value={form.brand_primary} onChange={(e) => u("brand_primary", e.target.value)} />
        </div>
        <div>
          <label className="label">Data region</label>
          <select className="input" value={form.region} onChange={(e) => u("region", e.target.value)}>
            <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
            <option value="ap-southeast-3">ap-southeast-3 (Jakarta)</option>
            <option value="eu-west-1">eu-west-1</option>
            <option value="us-east-1">us-east-1</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-border px-5 py-3">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
