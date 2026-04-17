import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { supabaseServer } from "@/lib/supabase/server";
import { InsightCard } from "./insight-card";
import { GenerateInsightsButton } from "./generate-button";
import type { AiInsight } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const sb = supabaseServer();
  const { data } = await sb
    .from("ai_insights")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(100);

  const insights = (data ?? []) as AiInsight[];
  const unread = insights.filter((i) => !i.acknowledged_at);

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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            Unread ({unread.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {unread.map((i) => <InsightCard key={i.id} insight={i} />)}
          </div>

          {insights.length > unread.length && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-600">Archive</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {insights.filter((i) => i.acknowledged_at).map((i) => <InsightCard key={i.id} insight={i} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
