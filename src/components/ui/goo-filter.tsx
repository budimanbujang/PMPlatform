// Shared SVG <defs> block for the gooey / metaball filter.
// Render this ONCE per page (placed in the root layout's <body>).
// Any component that wants the gooey merge effect references `url(#gi-goo)`.
//
// feGaussianBlur spreads each shape, then feColorMatrix snaps the alpha back
// to a hard threshold — the result is that overlapping circles "blob"
// together into one connected form. Classic worm / metaball trick.

export function GooFilterDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden
      focusable="false"
    >
      <defs>
        <filter id="gi-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          <feColorMatrix
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 22 -10"
          />
        </filter>
      </defs>
    </svg>
  );
}
