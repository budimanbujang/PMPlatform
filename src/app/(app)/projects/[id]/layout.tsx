import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/database";
import { ProjectTabs } from "./tabs";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const sb = supabaseServer();
  const { data, error } = await sb.from("projects").select("*").eq("id", params.id).single();
  if (error || !data) notFound();
  const p = data as Project;

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
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}
