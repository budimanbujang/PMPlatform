import { cn, ragLabel } from "@/lib/utils";
import type { ProjectRag } from "@/types/database";

const dotClass: Record<ProjectRag, string> = {
  green: "bg-[var(--rag-green)]",
  amber: "bg-[var(--rag-amber)]",
  red:   "bg-[var(--rag-red)]",
  grey:  "bg-[var(--rag-grey)]",
};

const pillClass: Record<ProjectRag, string> = {
  green: "rag-green",
  amber: "rag-amber",
  red:   "rag-red",
  grey:  "rag-grey",
};

export function RagBadge({ rag, withLabel = true }: { rag: ProjectRag; withLabel?: boolean }) {
  return (
    <span className={cn("pill", pillClass[rag])}>
      <span className={cn("dot", dotClass[rag])} />
      {withLabel ? ragLabel(rag) : rag.toUpperCase()}
    </span>
  );
}
