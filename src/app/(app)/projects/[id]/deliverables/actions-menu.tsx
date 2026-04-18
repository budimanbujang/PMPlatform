"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setDeliverableStatus } from "./actions";

export function DeliverableActions({ deliverableId }: { deliverableId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function update(status: "in_progress" | "blocked" | "complete") {
    start(async () => {
      try {
        await setDeliverableStatus(deliverableId, status);
        toast.success("Updated");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <button className="btn-ghost text-xs" onClick={() => update("in_progress")} disabled={pending}>Start</button>
      <button className="btn-ghost text-xs" onClick={() => update("blocked")} disabled={pending}>Block</button>
      <button className="btn-ghost text-xs" onClick={() => update("complete")} disabled={pending}>Done</button>
    </div>
  );
}
