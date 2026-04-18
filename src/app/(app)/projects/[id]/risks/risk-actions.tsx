"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { closeRisk } from "./actions";

export function RiskActions({ riskId }: { riskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function close() {
    start(async () => {
      try {
        await closeRisk(riskId);
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed");
      }
    });
  }

  return (
    <button type="button" onClick={close} disabled={pending} className="btn-ghost text-xs">Close</button>
  );
}
