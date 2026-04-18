// Injected in <head> so the correct [data-theme] is applied before React
// hydrates. Reads localStorage.pmo-theme; if absent, defaults to dark.
// This prevents the flash-of-light-theme on first load.
//
// Must be a server component that returns a script tag. No hooks, no imports.

export function ThemeInit() {
  const code = `
    (function () {
      try {
        var stored = localStorage.getItem('pmo-theme');
        // Default to dark mode for new users. Override via the theme toggle.
        var theme = stored || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
      } catch (_) { /* no-op */ }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
