// Injected in <head> so the correct [data-theme] is applied before React
// hydrates. Reads localStorage.theme; if absent, follows prefers-color-scheme.
// Prevents the light-mode flash when the user has dark mode set.
//
// Must be a server component that returns a script tag. No hooks, no imports.

export function ThemeInit() {
  const code = `
    (function () {
      try {
        var stored = localStorage.getItem('pmo-theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var theme = stored || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
      } catch (_) { /* no-op */ }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
