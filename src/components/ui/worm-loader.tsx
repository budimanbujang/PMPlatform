import { cn } from "@/lib/utils";

/**
 * Organic trailing-worm loader — 4 overlapping circles animating on a square
 * path with staggered delays, merged by the gooey SVG filter from
 * components/ui/goo-filter.tsx. Colour follows `currentColor`, so the worm
 * adopts the surrounding text colour (white on the mustard primary button,
 * brand text on ghost buttons, etc.) — light + dark themes handled for free.
 *
 * Sized at 22×22 by default (matches the reference). Override with `size`.
 */

export function WormLoader({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block flex-none align-middle", className)}
      style={{
        width:  size,
        height: size,
        color: "currentColor",
        filter: "url(#gi-goo)",
      }}
    >
      <svg viewBox="0 0 22 22" className="block w-full h-full overflow-visible">
        <circle className="worm-n1" cx="11" cy="11" r="3.2" />
        <circle className="worm-n2" cx="11" cy="11" r="3.2" />
        <circle className="worm-n3" cx="11" cy="11" r="3.2" />
        <circle className="worm-n4" cx="11" cy="11" r="3.2" />
      </svg>
    </span>
  );
}
