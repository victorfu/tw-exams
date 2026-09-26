// No "use client": the root layout (a Server Component) inlines
// THEME_INIT_SCRIPT, so it needs the actual string, not a client reference.

export const THEME_STORAGE_KEY = "ollie-theme";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before first paint (inlined in <head> of the root layout) so the saved
 * theme applies without a flash. Mirrors readStoredPreference +
 * applyResolvedTheme in ThemeContext.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var sysDark = window.matchMedia("${DARK_QUERY}").matches;
    var isDark = stored === "dark" || ((stored === "system" || !stored) && sysDark);
    var root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "paopaodark" : "paopaolight");
  } catch (e) {}
})();`;
