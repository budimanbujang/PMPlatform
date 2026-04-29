import { Outfit } from "next/font/google";

/**
 * Single typeface for the entire platform: Outfit (variable, weights 100–900),
 * served via next/font/google so the woff2 is self-hosted at build time and
 * no runtime request to fonts.googleapis.com is needed.
 *
 * The CSS custom property `--font-outfit` (set on <html> via the className
 * attached in app/layout.tsx) is referenced from tokens.css under both
 * --font-display and --font-sans, so any utility that resolves to either
 * uses Outfit. Mono falls back to ui-monospace per tokens.css.
 */
export const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// Back-compat exports — older imports referenced these names. Both now
// resolve to the same Outfit font object so the woff2 is fetched once.
export const displayFont = outfit;
export const sansFont    = outfit;
