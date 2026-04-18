import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/database";
import { ProjectTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const rows = await sql`SELECT * FROM projects WHERE id = ${params.id} LIMIT 1`;
  const p = rows[0] as unknown as Project | undefined;
  if (!p) notFound();

  return (
    <>
      <PageHeader
        title={`${p.code} · ${p.name}`}
        description={p.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <RagBadge rag={p.rag} />
            <Link href={`/projects/${p.id}/submit`} className="btn-primary">Submit update</Link>
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
        <Meta label="Status" value={<span className="capitalize">{p.status.replace("_", " ")}</span>} />
        <Meta label="Cadence" value={<span className="capitalize">{p.cadence}</span>} />
        <Meta label="Start" value={formatDate(p.start_date)} />
        <Meta label="Target end" value={formatDate(p.target_end_date)} />
      </div>
      <ProjectTabs projectId={p.id} />
      <div className="mt-4">{children}</div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-fg1">{value}</div>
    </div>
  );
}
