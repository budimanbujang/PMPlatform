import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProjectRag } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ragLabel(rag: ProjectRag): string {
  return { green: "On track", amber: "At risk", red: "Blocked", grey: "Pending" }[rag];
}

export function ragClasses(rag: ProjectRag): string {
  return {
    green: "bg-green-100 text-green-800 border-green-300",
    amber: "bg-amber-100 text-amber-800 border-amber-300",
    red: "bg-red-100 text-red-800 border-red-300",
    grey: "bg-slate-100 text-slate-700 border-slate-300",
  }[rag];
}

export function formatCurrency(amount: number, currency = "MYR"): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Monday of the ISO week for a given date (local time).
export function isoWeekStart(d: Date = new Date()): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Mon
  dt.setDate(dt.getDate() - diff);
  return dt;
}

export function isoWeekEnd(d: Date = new Date()): Date {
  const start = isoWeekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
