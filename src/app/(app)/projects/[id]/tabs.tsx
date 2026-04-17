"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview",    label: "Overview" },
  { key: "initiatives", label: "Initiatives" },
  { key: "deliverables",label: "Deliverables" },
  { key: "risks",       label: "Risks" },
  { key: "budget",      label: "Budget" },
  { key: "reports",     label: "Reports" },
  { key: "members",     label: "Members" },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => {
        const href = t.key === "overview" ? base : `${base}/${t.key}`;
        const active =
          t.key === "overview"
            ? pathname === base
            : pathname.startsWith(href);
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              active
                ? "border-brand-600 text-brand-700 font-medium"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
