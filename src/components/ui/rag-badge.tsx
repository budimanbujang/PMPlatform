import { cn, ragClasses, ragLabel } from "@/lib/utils";
import type { ProjectRag } from "@/types/database";

export function RagBadge({ rag, withLabel = true }: { rag: ProjectRag; withLabel?: boolean }) {
  return (
    <span className={cn("badge", ragClasses(rag))}>
      <span
        className={cn(
          "mr-1 h-1.5 w-1.5 rounded-full",
          rag === "green" && "bg-green-500",
          rag === "amber" && "bg-amber-500",
          rag === "red"   && "bg-red-500",
          rag === "grey"  && "bg-slate-400",
        )}
      />
      {withLabel ? ragLabel(rag) : rag.toUpperCase()}
    </span>
  );
}
