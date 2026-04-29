"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, LayoutList, KanbanSquare } from "lucide-react";
import { RagBadge } from "@/components/ui/rag-badge";
import { cn } from "@/lib/utils";
import type { Initiative, ProjectRag } from "@/types/database";
import { addInitiative, deleteInitiative, setInitiativeRag } from "./actions";

interface Props {
  projectId: string;
  organisationId: string;
  initiatives: Initiative[];
  owners: { profile_id: string; name: string }[];
}

const RAG_COLUMNS: { rag: ProjectRag; title: string; subtitle: string; accent: string }[] = [
  { rag: "green", title: "On track", subtitle: "Green",   accent: "bg-green-500" },
  { rag: "amber", title: "At risk",  subtitle: "Amber",   accent: "bg-amber-500" },
  { rag: "red",   title: "Blocked",  subtitle: "Red",     accent: "bg-red-500" },
  { rag: "grey",  title: "Pending",  subtitle: "Grey",    accent: "bg-slate-400" },
];

export function InitiativeManager(p: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", champion_id: "" });
  const [pending, start] = useTransition();
  const [view, setView] = useState<"list" | "kanban">("list");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const nextOrder = (p.initiatives[p.initiatives.length - 1]?.sort_order ?? 0) + 1;
    start(async () => {
      try {
        await addInitiative({
          projectId: p.projectId,
          organisationId: p.organisationId,
          code: form.code,
          name: form.name,
          championId: form.champion_id,
          sortOrder: nextOrder,
        });
        toast.success("Initiative added");
        setForm({ code: "", name: "", champion_id: "" });
        router.refresh();
      } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this initiative? All submissions on it will be cascade-deleted.")) return;
    start(async () => {
      try { await deleteInitiative(id, p.projectId); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Failed"); }
    });
  }

  function setRag(id: string, rag: ProjectRag) {
    start(async () => {
      try { await setInitiativeRag(id, rag, p.projectId); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Failed"); }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className="label">Code</label>
            <input className="input" required value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Name</label>
            <input className="input" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Champion</label>
            <select className="input" value={form.champion_id}
              onChange={(e) => setForm((f) => ({ ...f, champion_id: e.target.value }))}>
              <option value="">—</option>
              {p.owners.map((m) => <option key={m.profile_id} value={m.profile_id}>{m.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> Add initiative
          </button>
        </div>
      </form>

      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-bg-subtle p-1 w-fit">
        <ViewBtn active={view === "list"}   onClick={() => setView("list")}   icon={<LayoutList    className="h-3.5 w-3.5" />} label="List"   />
        <ViewBtn active={view === "kanban"} onClick={() => setView("kanban")} icon={<KanbanSquare  className="h-3.5 w-3.5" />} label="Kanban" />
      </div>

      {view === "list" ? (
        <ListView initiatives={p.initiatives} onSetRag={setRag} onRemove={remove} pending={pending} />
      ) : (
        <KanbanView initiatives={p.initiatives} onSetRag={setRag} pending={pending} />
      )}
    </div>
  );
}

function ViewBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
        active ? "bg-surface text-fg1 shadow-sm" : "text-fg3 hover:text-fg1",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────
// LIST VIEW (existing table)
// ───────────────────────────────────────────────────────────────────
function ListView({
  initiatives, onSetRag, onRemove, pending,
}: {
  initiatives: Initiative[];
  onSetRag: (id: string, rag: ProjectRag) => void;
  onRemove: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Code</th><th>Name</th><th>RAG</th><th>Quick set</th><th></th></tr>
        </thead>
        <tbody>
          {initiatives.map((i) => (
            <tr key={i.id}>
              <td className="font-mono text-xs">{i.code}</td>
              <td className="font-medium">{i.name}</td>
              <td><RagBadge rag={i.rag} /></td>
              <td>
                <div className="flex gap-1">
                  {(["green","amber","red","grey"] as ProjectRag[]).map((r) => (
                    <button key={r} type="button" disabled={pending}
                      onClick={() => onSetRag(i.id, r)}
                      className="rounded-md border border-border px-2 py-0.5 text-xs capitalize hover:bg-bg-muted">
                      {r}
                    </button>
                  ))}
                </div>
              </td>
              <td className="text-right">
                <button className="btn-ghost" onClick={() => onRemove(i.id)} disabled={pending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {!initiatives.length && (
            <tr><td colSpan={5} className="text-center text-fg3 py-6">No initiatives yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// KANBAN VIEW — 4 columns by RAG. Cards can be moved by:
//   1. Dragging the card with the mouse to another column, OR
//   2. Clicking one of the four colour dots on the card.
// Both paths call the same setInitiativeRag server action.
// ───────────────────────────────────────────────────────────────────
function KanbanView({
  initiatives, onSetRag, pending,
}: {
  initiatives: Initiative[];
  onSetRag: (id: string, rag: ProjectRag) => void;
  pending: boolean;
}) {
  // Group by current RAG.
  const byRag: Record<ProjectRag, Initiative[]> = {
    green: [], amber: [], red: [], grey: [],
  };
  for (const i of initiatives) {
    byRag[i.rag] = byRag[i.rag] ?? [];
    byRag[i.rag].push(i);
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }
  function handleDragEnd() { setDraggingId(null); }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>, rag: ProjectRag) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    if (!id) return;
    // Skip the round-trip if the user dropped onto the column the card
    // already lives in.
    const current = initiatives.find((x) => x.id === id);
    if (current && current.rag !== rag) onSetRag(id, rag);
  }

  if (initiatives.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle py-10 text-center text-sm text-fg3">
        Add an initiative to see the Kanban board.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {RAG_COLUMNS.map(({ rag, title, subtitle, accent }) => {
        const items = byRag[rag] ?? [];
        const isSourceColumn = !!draggingId && items.some((i) => i.id === draggingId);
        const isPotentialTarget = !!draggingId && !isSourceColumn;
        return (
          <div
            key={rag}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, rag)}
            className={cn(
              "rounded-md border bg-bg-subtle transition-colors",
              isPotentialTarget
                ? "border-brand-500 ring-2 ring-brand-500/30"
                : "border-border",
              isSourceColumn && "opacity-70",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${accent}`} aria-hidden />
                <div>
                  <div className="text-[13px] font-semibold text-fg1">{title}</div>
                  <div className="text-[10px] uppercase tracking-wider text-fg3">{subtitle}</div>
                </div>
              </div>
              <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium tabular text-fg3">
                {items.length}
              </span>
            </div>
            <div className="space-y-2 p-2 min-h-[80px]">
              {items.map((i) => (
                <KanbanCard
                  key={i.id}
                  initiative={i}
                  onSetRag={onSetRag}
                  pending={pending}
                  isDragging={draggingId === i.id}
                  onDragStart={(e) => handleDragStart(e, i.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border bg-surface/30 py-4 text-center text-[11px] text-fg4">
                  {isPotentialTarget
                    ? "Drop here to move."
                    : "Drag a card here, or click a colour dot."}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  initiative, onSetRag, pending, isDragging, onDragStart, onDragEnd,
}: {
  initiative: Initiative;
  onSetRag: (id: string, rag: ProjectRag) => void;
  pending: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd:   () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-md border border-border bg-surface p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing select-none",
        "transition-[opacity,box-shadow] duration-fast",
        isDragging && "opacity-50 ring-2 ring-brand-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg3">{initiative.code}</div>
          <div className="text-[13px] font-semibold text-fg1 leading-snug">{initiative.name}</div>
        </div>
        <RagBadge rag={initiative.rag} withLabel={false} />
      </div>
      <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
        {(["green","amber","red","grey"] as ProjectRag[]).map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending || initiative.rag === r}
            onClick={() => onSetRag(initiative.id, r)}
            // Stop drag from firing when the user just wants to click the dot.
            onMouseDown={(e) => e.stopPropagation()}
            draggable={false}
            title={`Move to ${r}`}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
              initiative.rag === r
                ? "border-brand-500 ring-1 ring-brand-500/40"
                : "border-border hover:scale-110",
              r === "green" && "bg-green-500",
              r === "amber" && "bg-amber-500",
              r === "red"   && "bg-red-500",
              r === "grey"  && "bg-slate-400",
            )}
            aria-label={`Set RAG to ${r}`}
          />
        ))}
      </div>
    </div>
  );
}
