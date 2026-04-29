"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { attachProjectToPortfolio } from "../actions";

interface AvailableProject {
  id: string;
  code: string;
  name: string;
  current_portfolio_name: string | null;
}

/**
 * "+ Add existing project" picker. Shows projects in the same org that
 * aren't currently in this portfolio (Independent or in a different one)
 * so admins can sweep them in without recreating.
 */
export function AddExistingProjectButton({
  portfolioId,
  available,
}: {
  portfolioId: string;
  available: AvailableProject[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <Plus className="mr-1.5 h-4 w-4" /> Add existing
      </button>
      {open && <PickerDialog portfolioId={portfolioId} available={available} onClose={() => setOpen(false)} />}
    </>
  );
}

function PickerDialog({
  portfolioId, available, onClose,
}: {
  portfolioId: string;
  available: AvailableProject[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function attach(projectId: string) {
    start(async () => {
      try {
        await attachProjectToPortfolio(projectId, portfolioId);
        toast.success("Project moved into this portfolio");
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed");
      }
    });
  }

  const filtered = q.trim()
    ? available.filter((p) =>
        `${p.code} ${p.name}`.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : available;

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[14px] font-semibold">Add existing project</h2>
          <button type="button" onClick={onClose} className="btn-ghost text-xs" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {available.length === 0 ? (
            <p className="text-sm text-fg3 py-8 text-center">
              Every other project is already in a portfolio.
            </p>
          ) : (
            <>
              <input
                type="search"
                className="input mb-3"
                placeholder="Search by code or name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              <div className="max-h-[320px] divide-y divide-border overflow-auto rounded-md border border-border">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={pending}
                    onClick={() => attach(p.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-bg-muted disabled:opacity-50"
                  >
                    <div>
                      <div className="font-medium text-fg1">{p.code} · {p.name}</div>
                      <div className="text-[11px] text-fg3">
                        Currently in: {p.current_portfolio_name ?? "Independent"}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-brand-600" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-sm text-fg3">No matches.</div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
