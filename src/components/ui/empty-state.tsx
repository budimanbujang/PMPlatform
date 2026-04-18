import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-body flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg-muted text-fg3">
          <Icon className="h-6 w-6 stroke-[1.5]" />
        </div>
        <h3 className="text-[15px] font-semibold text-fg1">{title}</h3>
        {description && <p className="mt-1 max-w-md text-[13px] text-fg3">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
