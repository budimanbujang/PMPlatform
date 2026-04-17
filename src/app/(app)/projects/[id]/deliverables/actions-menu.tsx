"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

export function DeliverableActions({ deliverableId }: { deliverableId: string }) {
  const router = useRouter();

  async function setStatus(status: "in_progress" | "blocked" | "complete") {
    const patch: Record<string, unknown> = { status };
    if (status === "complete") patch.completed_at = new Date().toISOString();
    const { error } = await supabaseBrowser().from("deliverables").update(patch).eq("id", deliverableId);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      <button className="btn-ghost text-xs" onClick={() => setStatus("in_progress")}>Start</button>
      <button className="btn-ghost text-xs" onClick={() => setStatus("blocked")}>Block</button>
      <button className="btn-ghost text-xs" onClick={() => setStatus("complete")}>Done</button>
    </div>
  );
}
