import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const profile = await requireProfile();
  const orgId = profile.organisation_id;

  let projects: any[] = [];
  let submissions: any[] = [];
  let deliverables: any[] = [];
  let risks: any[] = [];
  let documents: any[] = [];

  if (q) {
    const like = `%${q}%`;
    [projects, submissions, deliverables, risks, documents] = await Promise.all([
      sql`
        SELECT id, code, name, description FROM projects
        WHERE organisation_id = ${orgId}
          AND (name ILIKE ${like} OR code ILIKE ${like} OR description ILIKE ${like})
        LIMIT 20
      `,
      sql`
        SELECT id, project_id, headline, period_start FROM submissions
        WHERE organisation_id = ${orgId}
          AND (headline ILIKE ${like} OR progress_notes ILIKE ${like} OR narrative ILIKE ${like})
        LIMIT 20
      `,
      sql`
        SELECT id, project_id, title, status FROM deliverables
        WHERE organisation_id = ${orgId} AND title ILIKE ${like}
        LIMIT 20
      `,
      sql`
        SELECT id, project_id, title, score FROM risks
        WHERE organisation_id = ${orgId} AND title ILIKE ${like}
        LIMIT 20
      `,
      sql`
        SELECT id, project_id, file_name, tag FROM documents
        WHERE organisation_id = ${orgId} AND file_name ILIKE ${like}
        LIMIT 20
      `,
    ]) as any;
  }

  return (
    <>
      <PageHeader title={q ? `Results for "${q}"` : "Search"} description="Across projects, submissions, deliverables, risks, documents." />
      {!q ? (
        <p className="text-sm text-fg3">Type a query in the search bar above.</p>
      ) : (
        <div className="space-y-6">
          <Section title={`Projects (${projects.length})`}>
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block rounded border border-border p-3 hover:bg-bg-muted">
                <div className="font-medium">{p.code} · {p.name}</div>
                {p.description && <div className="text-sm text-fg3 line-clamp-1">{p.description}</div>}
              </Link>
            ))}
          </Section>
          <Section title={`Submissions (${submissions.length})`}>
            {submissions.map((s) => (
              <Link key={s.id} href={`/projects/${s.project_id}`} className="block rounded border border-border p-3 hover:bg-bg-muted">
                <div className="font-medium">{s.headline ?? "Untitled update"}</div>
                <div className="text-xs text-fg3">Period {s.period_start}</div>
              </Link>
            ))}
          </Section>
          <Section title={`Deliverables (${deliverables.length})`}>
            {deliverables.map((d) => (
              <Link key={d.id} href={`/projects/${d.project_id}/deliverables`} className="block rounded border border-border p-3 hover:bg-bg-muted">
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-fg3 capitalize">{d.status.replace("_"," ")}</div>
              </Link>
            ))}
          </Section>
          <Section title={`Risks (${risks.length})`}>
            {risks.map((r) => (
              <Link key={r.id} href={`/projects/${r.project_id}/risks`} className="block rounded border border-border p-3 hover:bg-bg-muted">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-fg3">Score {r.score}</div>
              </Link>
            ))}
          </Section>
          <Section title={`Documents (${documents.length})`}>
            {documents.map((d) => (
              <div key={d.id} className="rounded border border-border p-3 text-sm">
                <div className="font-medium">{d.file_name}</div>
                <div className="text-xs text-fg3">{d.tag}</div>
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
      <h2 className="eyebrow mb-2">{title}</h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>
    </section>
  );
}
