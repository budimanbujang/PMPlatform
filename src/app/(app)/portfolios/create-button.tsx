"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, X, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import { DIVISIONS, departmentsFor } from "@/lib/divisions";
import { createPortfolio } from "./actions";

export function CreatePortfolioButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="mr-1.5 h-4 w-4" /> New portfolio
      </button>
      {open && <CreateDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    division: "",
    department: "",
    accessMode: "public" as "public" | "restricted",
    allowedEntraGroupsRaw: "",
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const u = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const departments = departmentsFor(form.division);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const groups = form.allowedEntraGroupsRaw
      .split(/[\n,]/)
      .map((g) => g.trim())
      .filter(Boolean);

    start(async () => {
      try {
        const { id } = await createPortfolio({
          code: form.code,
          name: form.name,
          description: form.description,
          division: form.division,
          department: form.department,
          accessMode: form.accessMode,
          allowedEntraGroups: groups,
        });
        toast.success("Portfolio created");
        onClose();
        router.push(`/portfolios/${id}`);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to create portfolio");
      }
    });
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Create portfolio"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl rounded-lg border border-border bg-surface shadow-lg max-h-[90vh] overflow-auto"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[14px] font-semibold">New portfolio</h2>
          <button type="button" onClick={onClose} className="btn-ghost text-xs" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div>
            <label className="label">Code *</label>
            <input
              className="input" required maxLength={32}
              placeholder="e.g. IRIS_PORTFOLIO"
              value={form.code}
              onChange={(e) => u("code", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name}
              onChange={(e) => u("name", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input min-h-[60px]"
              placeholder="Strategic intent of this portfolio."
              value={form.description}
              onChange={(e) => u("description", e.target.value)} />
          </div>

          <div>
            <label className="label">Division</label>
            <select className="input" value={form.division}
              onChange={(e) => { u("division", e.target.value); u("department", ""); }}>
              <option value="">—</option>
              {DIVISIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select
              className="input"
              value={form.department}
              onChange={(e) => u("department", e.target.value)}
              disabled={!form.division || departments.length === 0}
            >
              <option value="">{departments.length === 0 ? "(select division first)" : "—"}</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Access control */}
          <div className="md:col-span-2 mt-2 rounded-md border border-border bg-bg-subtle p-4">
            <div className="mb-3 text-[13px] font-semibold text-fg1">Visibility</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${form.accessMode === "public" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-border"}`}>
                <input
                  type="radio" name="accessMode" value="public" className="mt-1"
                  checked={form.accessMode === "public"}
                  onChange={() => u("accessMode", "public")}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg1">
                    <Globe className="h-3.5 w-3.5" /> Public
                  </div>
                  <p className="mt-0.5 text-[11px] text-fg3">Anyone signed into JCorp PMPlatform can view.</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${form.accessMode === "restricted" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-border"}`}>
                <input
                  type="radio" name="accessMode" value="restricted" className="mt-1"
                  checked={form.accessMode === "restricted"}
                  onChange={() => u("accessMode", "restricted")}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg1">
                    <Lock className="h-3.5 w-3.5" /> Restricted to Entra groups
                  </div>
                  <p className="mt-0.5 text-[11px] text-fg3">Only members of the listed Entra security groups can view.</p>
                </div>
              </label>
            </div>

            {form.accessMode === "restricted" && (
              <div className="mt-3">
                <label className="label">Allowed Entra group object IDs</label>
                <textarea
                  className="input min-h-[70px] font-mono text-[12px]"
                  placeholder={"01234567-89ab-cdef-0123-456789abcdef\nfedcba98-7654-3210-fedc-ba9876543210"}
                  value={form.allowedEntraGroupsRaw}
                  onChange={(e) => u("allowedEntraGroupsRaw", e.target.value)}
                />
                <p className="mt-1 text-[11px] text-fg3">
                  One per line, or comma-separated. Find IDs in Entra → Groups →
                  Object ID. Platform admins always see every portfolio regardless.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create portfolio"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
