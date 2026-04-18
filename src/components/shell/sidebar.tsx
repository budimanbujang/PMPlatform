"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, FileText, Upload, Target,
  AlertTriangle, Wallet, Sparkles, Settings, ListChecks, Users2,
  type LucideIcon,
} from "lucide-react";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const workspace: NavItem[] = [
  { href: "/",            label: "Dashboard",        icon: LayoutDashboard },
  { href: "/projects",    label: "Projects",         icon: FolderKanban },
  { href: "/submissions", label: "My submissions",   icon: FileText },
  { href: "/deliverables",label: "Deliverables",     icon: Target },
  { href: "/risks",       label: "Risks",            icon: AlertTriangle },
  { href: "/budget",      label: "Budget",           icon: Wallet },
  { href: "/reports",     label: "Reports",          icon: ListChecks },
  { href: "/insights",    label: "Insights",         icon: Sparkles },
];

const admin: NavItem[] = [
  { href: "/admin/organisation", label: "Organisation", icon: Settings },
  { href: "/admin/members",      label: "Members",      icon: Users2 },
  { href: "/admin/templates",    label: "Templates",    icon: Upload },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex flex-col min-h-0 bg-surface border-r border-border">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-brand-600 font-display text-[17px] font-extrabold leading-none text-white flex-shrink-0">
          J
        </div>
        <div>
          <div className="text-[13px] font-semibold text-fg1 leading-none">JCorp PMO</div>
          <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-fg3">Platform</div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg4">
          Workspace
        </div>
        {workspace.map((i) => <NavLink key={i.href} item={i} active={isActive(i.href)} />)}

        {profile.is_platform_admin && (
          <>
            <div className="mt-3 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg4">
              Admin
            </div>
            {admin.map((i) => <NavLink key={i.href} item={i} active={isActive(i.href)} />)}
          </>
        )}
      </nav>

      <div className="border-t border-border px-4 py-3 text-[11px] text-fg3">
        <div className="font-medium text-fg2">{profile.full_name ?? profile.email}</div>
        <div className="truncate">{profile.email}</div>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-fast ease-standard",
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
          : "text-fg2 hover:bg-bg-muted",
      )}
    >
      <Icon className="h-4 w-4 stroke-[1.8] flex-shrink-0" />
      {item.label}
    </Link>
  );
}
