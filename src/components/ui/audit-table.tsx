import { formatDateTime } from "@/lib/utils";

export interface AuditEntry {
  id: string | number;
  at: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  diff: any;
}

// Prettify snake_case action keys for display.
function prettyAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\./g, " → ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Render a single diff entry as "field: before → after"
function renderChanges(diff: any): React.ReactNode {
  if (!diff) return null;
  // Updated payload shape: { projectId, changes: { field: {before, after} } }
  if (diff.changes && typeof diff.changes === "object") {
    const entries = Object.entries(diff.changes as Record<string, { before: unknown; after: unknown }>);
    if (entries.length === 0) return <span className="text-fg4">No tracked fields changed.</span>;
    return (
      <ul className="space-y-1">
        {entries.map(([field, { before, after }]) => (
          <li key={field} className="flex items-start gap-2 text-[12px]">
            <span className="font-mono text-fg3 min-w-[120px]">{field}</span>
            <span className="text-fg3 line-through decoration-red-400/60 break-all">
              {fmt(before)}
            </span>
            <span className="text-fg3">→</span>
            <span className="font-medium text-fg1 break-all">{fmt(after)}</span>
          </li>
        ))}
      </ul>
    );
  }
  // Creation / deletion payloads
  if (diff.created) {
    return <InlineJson label="Created" value={diff.created} />;
  }
  if (diff.deleted) {
    return <InlineJson label="Deleted" value={diff.deleted} />;
  }
  return <InlineJson label="Details" value={diff} />;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return v ? "yes" : "no";
  return JSON.stringify(v);
}

function InlineJson({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="text-[12px]">
      <span className="font-mono text-fg3 mr-2">{label}:</span>
      <code className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[11px]">
        {typeof value === "string" ? value : JSON.stringify(value)}
      </code>
    </div>
  );
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-fg3 py-6 text-center">
        No changes logged yet.
      </p>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="align-top">
              <td className="whitespace-nowrap text-fg2">
                {formatDateTime(e.at)}
              </td>
              <td>
                <div className="font-medium">{e.actor_name ?? e.actor_email ?? "System"}</div>
                {e.actor_email && e.actor_name && (
                  <div className="text-[11px] text-fg3">{e.actor_email}</div>
                )}
              </td>
              <td className="whitespace-nowrap">{prettyAction(e.action)}</td>
              <td className="font-mono text-[11px] text-fg3">
                {e.entity_type}
                {e.entity_id && <div className="opacity-60">{e.entity_id.slice(0, 8)}…</div>}
              </td>
              <td className="min-w-[260px]">{renderChanges(e.diff)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
