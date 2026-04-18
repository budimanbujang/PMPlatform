import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { InsightCard } from "./insight-card";
import { GenerateInsightsButton } from "./generate-button";
import type { AiInsight } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const profile = await requireProfile();

  const rows = await sql`
    SELECT * FROM ai_insights
    WHERE organisation_id = ${profile.organisation_id}
    ORDER BY generated_at DESC
    LIMIT 100
  `;
  const insights = rows as unknown as AiInsight[];
  const unread = insights.filter((i) => !i.acknowledged_at);
  const archive = insights.filter((i) => i.acknowledged_at);

  return (
    <>
      <PageHeader
        title="Insights"
        description="AI-generated signals across the portfolio — anomalies, patterns, gaps, predictions."
        actions={<GenerateInsightsButton />}
      />

      {insights.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No insights yet"
          description="Insights generate automatically after weekly reports run, or trigger them manually."
          action={<GenerateInsightsButton />}
        />
      ) : (
        <div className="space-y-4">
          <h2 className="eyebrow">Unread ({unread.length})</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {unread.map((i) => <InsightCard key={i.id} insight={i} />)}
          </div>

          {archive.length > 0 && (
            <>
              <h2 className="eyebrow mt-8">Archive</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {archive.map((i) => <InsightCard key={i.id} insight={i} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
