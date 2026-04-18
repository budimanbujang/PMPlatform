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

// 4-point sparkle mark used as the JCorp PMPlatform brand glyph.
function SparkleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 1.5 L13.7 10.3 L22.5 12 L13.7 13.7 L12 22.5 L10.3 13.7 L1.5 12 L10.3 10.3 Z" />
    </svg>
  );
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex flex-col min-h-0 bg-surface dark:bg-[#0d0d0d] border-r border-border">
      <div className="flex h-14 items-center gap-2.5 border-b border-border dark:border-white/10 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-brand-600 text-white flex-shrink-0">
          <SparkleMark className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[13px] font-medium text-fg1 dark:text-white leading-none">
            JCorp <span className="font-extrabold">PMP</span>latform
          </div>
          <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-fg3 dark:text-slate-400">
            Platform
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg4 dark:text-slate-400">
          Workspace
        </div>
        {workspace.map((i) => <NavLink key={i.href} item={i} active={isActive(i.href)} />)}

        {profile.is_platform_admin && (
          <>
            <div className="mt-3 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg4 dark:text-slate-400">
              Admin
            </div>
            {admin.map((i) => <NavLink key={i.href} item={i} active={isActive(i.href)} />)}
          </>
        )}
      </nav>

      <div className="border-t border-border dark:border-white/10 px-4 py-3 text-[11px] text-fg3 dark:text-slate-400">
        <div className="font-medium text-fg2 dark:text-slate-100">{profile.full_name ?? profile.email}</div>
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
          // Selected: cream/mustard ground with near-black text — user-specified #0d0d0d
          ? "bg-brand-50 text-[#0d0d0d]"
          // Inactive: light-grey text in dark mode; hover lifts to #0d0d0d on the mustard tint
          : "text-fg2 dark:text-slate-200 hover:bg-brand-50 hover:text-[#0d0d0d]",
      )}
    >
      <Icon className="h-4 w-4 stroke-[1.8] flex-shrink-0" />
      {item.label}
    </Link>
  );
}
