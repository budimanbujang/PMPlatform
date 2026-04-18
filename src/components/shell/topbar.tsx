"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Menu } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 md:px-6">
      <button className="md:hidden rounded-md p-2 hover:bg-bg-muted text-fg2" aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={onSearch} className="flex-1 max-w-[440px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-2 text-fg4" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, deliverables, risks, documents…"
            className="w-full rounded-md border border-border-strong bg-surface py-2 pl-9 pr-3 text-[13px] text-fg1 placeholder:text-fg4 focus:border-brand-500 focus:outline-none focus:[box-shadow:0_0_0_1px_var(--brand-500)]"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden md:block text-right leading-tight">
          <div className="text-[12px] font-medium text-fg1">{profile.full_name ?? profile.email}</div>
          <div className="text-[11px] text-fg3">{profile.job_title ?? "Member"}</div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md p-2 text-fg2 transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:shadow-focus"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
