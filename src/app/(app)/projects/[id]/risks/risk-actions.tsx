"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

export function RiskActions({ riskId }: { riskId: string }) {
  const router = useRouter();
  async function close() {
    const { error } = await supabaseBrowser().from("risks")
      .update({ status: "closed" }).eq("id", riskId);
    if (error) return toast.error(error.message);
    router.refresh();
  }
  return (
    <button type="button" onClick={close} className="btn-ghost text-xs">Close</button>
  );
}
