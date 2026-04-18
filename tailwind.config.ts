import type { Config } from "tailwindcss";

/**
 * Tailwind config wired to the design-system CSS custom properties defined in
 * src/app/tokens.css. Utilities like `bg-brand-600`, `text-fg1`, `border-border`
 * resolve to the CSS variables so dark mode swaps take effect automatically.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mustard brand scale — design-system primary.
        brand: {
          50:  "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          300: "var(--brand-300)",
          400: "var(--brand-400)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          800: "var(--brand-800)",
          900: "var(--brand-900)",
          950: "var(--brand-950)",
        },

        // Semantic foreground / background tokens.
        bg:          "var(--bg)",
        "bg-subtle": "var(--bg-subtle)",
        "bg-muted":  "var(--bg-muted)",
        surface:     "var(--surface)",
        "surface-2": "var(--surface-2)",
        fg1:         "var(--fg1)",
        fg2:         "var(--fg2)",
        fg3:         "var(--fg3)",
        fg4:         "var(--fg4)",
        "fg-brand":  "var(--fg-brand)",
        "fg-inverse":"var(--fg-inverse)",
        border:          "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-focus":  "var(--border-focus)",

        rag: {
          green: "var(--rag-green)",
          amber: "var(--rag-amber)",
          red:   "var(--rag-red)",
          grey:  "var(--rag-grey)",
        },

        // Keep raw Tailwind `slate-*` utilities available for targeted
        // overrides (e.g. dark:text-slate-200 on sidebar links).
        slate: {
          50:  "var(--slate-50)",
          100: "var(--slate-100)",
          200: "var(--slate-200)",
          300: "var(--slate-300)",
          400: "var(--slate-400)",
          500: "var(--slate-500)",
          600: "var(--slate-600)",
          700: "var(--slate-700)",
          800: "var(--slate-800)",
          900: "var(--slate-900)",
          950: "var(--slate-950)",
        },
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.4" }],
        xs:    ["12px", { lineHeight: "1.4" }],
        sm:    ["13px", { lineHeight: "1.5" }],
        base:  ["14px", { lineHeight: "1.5" }],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        focus: "var(--shadow-focus)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        fast:   "120ms",
        normal: "180ms",
        slow:   "260ms",
      },
      backgroundImage: {
        "ai-gradient": "linear-gradient(90deg, var(--ai-from) 0%, var(--ai-to) 100%)",
        "login-gradient-light":
          "linear-gradient(to bottom right, var(--brand-50), #ffffff, var(--slate-100, #f1f5f9))",
        "login-gradient-dark":
          "linear-gradient(to bottom right, #0b1220, #0f172a 60%, #111c2e)",
      },
    },
  },
  plugins: [],
};

export default config;
