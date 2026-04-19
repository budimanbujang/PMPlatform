import { cn } from "@/lib/utils";

/**
 * Thin horizontal indicator of budget consumption.
 *
 * Colour thresholds:
 *   ≤ 70%  → green   (comfortable burn rate)
 *   71–90% → amber   (watchful)
 *   > 90%  → red     (at or near cap)
 *   > 100% → solid red + subtle red glow (overspend)
 *
 * Purely presentational. No interaction logic.
 */
export function BudgetBar({
  used,
  total,
  className,
  ariaLabel,
}: {
  used: number;
  total: number;
  className?: string;
  ariaLabel?: string;
}) {
  // No budget set → nothing to render. Keeps cards with empty budgets tidy.
  if (!total || total <= 0) return null;

  const ratio = used / total;
  const displayPct = Math.round(ratio * 100);         // exact, may exceed 100
  const fillPct   = Math.min(100, Math.max(0, ratio * 100));  // capped for width
  const overspend = used > total;

  const band =
    overspend            ? "bg-red-500 dark:bg-red-400" :
    ratio <= 0.70        ? "bg-green-500 dark:bg-green-400" :
    ratio <= 0.90        ? "bg-amber-500 dark:bg-amber-400" :
                           "bg-red-500 dark:bg-red-400";

  const tooltip = overspend
    ? `${displayPct}% budget used — over cap`
    : `${displayPct}% budget used`;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel ?? "Budget consumption"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fillPct)}
      aria-valuetext={tooltip}
      title={tooltip}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-bg-muted",
        overspend &&
          "ring-1 ring-red-500/45 shadow-[0_0_10px_-2px_rgba(220,38,38,0.55)]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-slow ease-standard",
          band,
        )}
        style={{ width: `${fillPct}%` }}
      />
    </div>
  );
}
