"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { RagBadge } from "@/components/ui/rag-badge";
import type { Initiative, ProjectRag } from "@/types/database";

interface Props {
  projectId: string;
  organisationId: string;
  initiatives: Initiative[];
  owners: { profile_id: string; name: string }[];
}

export function InitiativeManager(p: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", champion_id: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const nextOrder = (p.initiatives[p.initiatives.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabaseBrowser().from("initiatives").insert({
      organisation_id: p.organisationId,
      project_id: p.projectId,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      champion_id: form.champion_id || null,
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    toast.success("Initiative added");
    setForm({ code: "", name: "", champion_id: "" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this initiative? All submissions on it will be cascade-deleted.")) return;
    const { error } = await supabaseBrowser().from("initiatives").delete().eq("id", id);
    if (error) return toast.error(error.message);
    router.refresh();
  }

  async function setRag(id: string, rag: ProjectRag) {
    const { error } = await supabaseBrowser().from("initiatives").update({ rag }).eq("id", id);
    if (error) return toast.error(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className="label">Code</label>
            <input className="input" required value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Name</label>
            <input className="input" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Champion</label>
            <select className="input" value={form.champion_id}
              onChange={(e) => setForm((f) => ({ ...f, champion_id: e.target.value }))}>
              <option value="">—</option>
              {p.owners.map((m) => <option key={m.profile_id} value={m.profile_id}>{m.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> Add initiative
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>RAG</th><th>Quick set</th><th></th></tr>
          </thead>
          <tbody>
            {p.initiatives.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs">{i.code}</td>
                <td className="font-medium">{i.name}</td>
                <td><RagBadge rag={i.rag} /></td>
                <td>
                  <div className="flex gap-1">
                    {(["green","amber","red","grey"] as ProjectRag[]).map((r) => (
                      <button key={r} type="button"
                        onClick={() => setRag(i.id, r)}
                        className="rounded-md border border-slate-200 px-2 py-0.5 text-xs capitalize hover:bg-slate-50">
                        {r}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="text-right">
                  <button className="btn-ghost" onClick={() => remove(i.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!p.initiatives.length && (
              <tr><td colSpan={5} className="text-center text-slate-500 py-6">No initiatives yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
