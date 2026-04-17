import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const sb = supabaseServer();

  let projects: any[] = [];
  let submissions: any[] = [];
  let deliverables: any[] = [];
  let risks: any[] = [];
  let documents: any[] = [];

  if (q) {
    const like = `%${q}%`;
    const res = await Promise.all([
      sb.from("projects").select("id, code, name, description").or(`name.ilike.${like},code.ilike.${like},description.ilike.${like}`).limit(20),
      sb.from("submissions").select("id, project_id, headline, period_start").or(`headline.ilike.${like},progress_notes.ilike.${like},narrative.ilike.${like}`).limit(20),
      sb.from("deliverables").select("id, project_id, title, status").ilike("title", like).limit(20),
      sb.from("risks").select("id, project_id, title, score").ilike("title", like).limit(20),
      sb.from("documents").select("id, project_id, file_name, tag").ilike("file_name", like).limit(20),
    ]);
    projects     = res[0].data ?? [];
    submissions  = res[1].data ?? [];
    deliverables = res[2].data ?? [];
    risks        = res[3].data ?? [];
    documents    = res[4].data ?? [];
  }

  return (
    <>
      <PageHeader title={q ? `Results for "${q}"` : "Search"} description="Across projects, submissions, deliverables, risks, documents." />
      {!q ? (
        <p className="text-sm text-slate-500">Type a query in the search bar above.</p>
      ) : (
        <div className="space-y-6">
          <Section title={`Projects (${projects.length})`}>
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                <div className="font-medium">{p.code} · {p.name}</div>
                {p.description && <div className="text-sm text-slate-600 line-clamp-1">{p.description}</div>}
              </Link>
            ))}
          </Section>
          <Section title={`Submissions (${submissions.length})`}>
            {submissions.map((s) => (
              <Link key={s.id} href={`/projects/${s.project_id}`} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                <div className="font-medium">{s.headline ?? "Untitled update"}</div>
                <div className="text-xs text-slate-500">Period {s.period_start}</div>
              </Link>
            ))}
          </Section>
          <Section title={`Deliverables (${deliverables.length})`}>
            {deliverables.map((d) => (
              <Link key={d.id} href={`/projects/${d.project_id}/deliverables`} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-slate-500 capitalize">{d.status.replace("_"," ")}</div>
              </Link>
            ))}
          </Section>
          <Section title={`Risks (${risks.length})`}>
            {risks.map((r) => (
              <Link key={r.id} href={`/projects/${r.project_id}/risks`} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-500">Score {r.score}</div>
              </Link>
            ))}
          </Section>
          <Section title={`Documents (${documents.length})`}>
            {documents.map((d) => (
              <div key={d.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="font-medium">{d.file_name}</div>
                <div className="text-xs text-slate-500">{d.tag}</div>
              </div>
            ))}
          </Section>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-600">{title}</h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>
    </section>
  );
}
