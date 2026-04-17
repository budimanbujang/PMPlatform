"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MemberRole } from "@/types/database";

interface MemberRow {
  id: string;
  profile_id: string;
  role: MemberRole;
  is_active: boolean;
  email: string;
  full_name: string;
  job_title: string;
}

const ROLES: MemberRole[] = [
  "sponsor","executive","pmo","tmo","iwc",
  "champion","io","delivery_lead","finance_controller","steering","viewer",
];

export function MemberManager({
  projectId, organisationId, members,
}: { projectId: string; organisationId: string; members: MemberRow[] }) {
  const router = useRouter();
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<MemberRole>("champion");

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const { data: profile, error: lookupErr } = await supabaseBrowser()
      .from("profiles").select("id").eq("email", addEmail.trim().toLowerCase()).single();
    if (lookupErr || !profile) return toast.error("No matching user — ask them to sign in once first.");
    const { error } = await supabaseBrowser().from("members").insert({
      organisation_id: organisationId,
      project_id: projectId,
      profile_id: profile.id,
      role: addRole,
    });
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setAddEmail("");
    router.refresh();
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from("members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addMember} className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Email</label>
            <input
              type="email" required className="input"
              placeholder="person@jcorp.my"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={addRole}
              onChange={(e) => setAddRole(e.target.value as MemberRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Title</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.full_name || "—"}</td>
                <td className="text-slate-600">{m.email}</td>
                <td className="capitalize">{m.role}</td>
                <td className="text-slate-600">{m.job_title || "—"}</td>
                <td className="text-right">
                  <button className="btn-ghost" onClick={() => remove(m.id)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-500 py-6">No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
