import localFont from "next/font/local";

/**
 * Fonts per the JCorp PMO design system:
 * - Gilroy (ExtraBold + Light) for display / brand headings
 * - Montserrat variable (roman + italic) for UI / body
 *
 * Exposed as CSS custom properties --font-display / --font-sans so every
 * token consumer (globals.css + Tailwind's `font-*` utilities) resolves to
 * the right face. Monospace is left to the system stack via tokens.css.
 */

export const displayFont = localFont({
  src: [
    { path: "../../public/fonts/Gilroy-Light.ttf",     weight: "300", style: "normal" },
    { path: "../../public/fonts/Gilroy-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display",
  fallback: ["Montserrat", "system-ui", "sans-serif"],
});

export const sansFont = localFont({
  src: [
    { path: "../../public/fonts/Montserrat-Variable.ttf",        weight: "100 900", style: "normal" },
    { path: "../../public/fonts/Montserrat-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
