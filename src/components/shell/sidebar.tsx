"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, FileText, Upload, Target,
  AlertTriangle, Wallet, Sparkles, Settings, ListChecks, Users2,
} from "lucide-react";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/",                 label: "Dashboard",    icon: LayoutDashboard },
  { href: "/projects",         label: "Projects",     icon: FolderKanban },
  { href: "/submissions",      label: "My submissions", icon: FileText },
  { href: "/deliverables",     label: "Deliverables", icon: Target },
  { href: "/risks",            label: "Risks",        icon: AlertTriangle },
  { href: "/budget",           label: "Budget",       icon: Wallet },
  { href: "/reports",          label: "Reports",      icon: ListChecks },
  { href: "/insights",         label: "Insights",     icon: Sparkles },
];

const adminNav = [
  { href: "/admin/organisation", label: "Organisation", icon: Settings },
  { href: "/admin/members",      label: "Members",      icon: Users2 },
  { href: "/admin/templates",    label: "Templates",    icon: Upload },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white font-bold">
          J
        </div>
        <div>
          <div className="text-sm font-semibold">JCorp PMO</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Platform</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </div>
        {nav.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
              isActive(i.href)
                ? "bg-brand-50 text-brand-700 font-medium"
                : "text-slate-700 hover:bg-slate-100",
            )}
          >
            <i.icon className="h-4 w-4" />
            {i.label}
          </Link>
        ))}

        {profile.is_platform_admin && (
          <>
            <div className="mt-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Admin
            </div>
            {adminNav.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  isActive(i.href)
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <i.icon className="h-4 w-4" />
                {i.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <div className="font-medium text-slate-700">{profile.full_name ?? profile.email}</div>
        <div>{profile.email}</div>
      </div>
    </aside>
  );
}
