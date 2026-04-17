"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Menu } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export function Topbar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <button className="md:hidden rounded-md p-2 hover:bg-slate-100" aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={onSearch} className="max-w-md flex-1 md:ml-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, deliverables, risks, documents…"
            className="input pl-9"
          />
        </div>
      </form>

      <div className="flex items-center gap-3">
        <div className="hidden md:block text-right text-xs leading-tight">
          <div className="font-medium text-slate-800">{profile.full_name ?? profile.email}</div>
          <div className="text-slate-500">{profile.job_title ?? "Member"}</div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="btn-ghost"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
