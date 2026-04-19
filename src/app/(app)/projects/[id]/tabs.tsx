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
  { key: "changelog",   label: "Changelog" },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="flex gap-1 border-b border-border overflow-x-auto">
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
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors duration-fast",
              active
                // Active: brighter mustard in dark mode, same brand accent
                // in light mode. The underline bar uses the same colour so
                // it reads as a continuous accent.
                ? "border-brand-500 text-brand-700 font-semibold dark:border-brand-300 dark:text-brand-300"
                // Inactive: muted slate in light mode, plain white in dark
                // mode so the tabs don't blur into the background.
                : "border-transparent text-fg2 hover:text-fg1 dark:text-white/90 dark:hover:text-white",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
