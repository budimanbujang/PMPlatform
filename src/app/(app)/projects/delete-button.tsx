"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProject } from "./actions";

/**
 * Small overlay delete button placed in the top-right of a project card.
 * Renders as an absolutely-positioned button so it can sit visually inside
 * the card while not being a child of the parent <Link> (would be invalid
 * HTML — interactive inside interactive). Click handlers stop propagation
 * to keep the parent card-link click from firing.
 */
export function ProjectDeleteButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = confirm(
      `Delete "${projectName}"?\n\n` +
      "This permanently removes the project and every initiative, " +
      "submission, deliverable, risk, budget line, document, and report " +
      "attached to it. This action is logged to the Audit log.\n\n" +
      "This cannot be undone.",
    );
    if (!ok) return;

    start(async () => {
      try {
        await deleteProject(projectId);
        toast.success(`Deleted "${projectName}"`);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to delete project");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="absolute top-3 right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-fg3 opacity-0 transition-opacity duration-fast hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:shadow-focus dark:hover:bg-red-500/10 dark:hover:text-red-400"
      title={`Delete project: ${projectName}`}
      aria-label={`Delete project ${projectName}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
