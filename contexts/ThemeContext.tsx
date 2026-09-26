"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
} from "./ThemeContextType";

export const THEME_STORAGE_KEY = "ollie-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const preferenceListeners = new Set<() => void>();

const readStoredPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "system";
};

const subscribePreference = (listener: () => void) => {
  preferenceListeners.add(listener);
  // Keep other tabs in sync.
  window.addEventListener("storage", listener);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

const getSystemPrefersDark = (): boolean => {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
};

const subscribeSystemTheme = (listener: () => void) => {
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia(DARK_QUERY);
  } catch {
    return () => {};
  }
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
};

/** Apply the resolved theme to <html>: `.dark` drives Tailwind/custom tokens,
 *  `data-theme` drives DaisyUI. Both flip together. */
const applyResolvedTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.setAttribute(
    "data-theme",
    resolved === "dark" ? "paopaodark" : "paopaolight",
  );
};

/**
 * Runs before first paint (inlined in the root layout) so the saved theme
 * applies without a flash. Mirrors readStoredPreference + applyResolvedTheme.
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

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Server snapshots are the defaults; the real values arrive right after
  // hydration, so server and client markup always match.
  const theme = useSyncExternalStore(
    subscribePreference,
    readStoredPreference,
    () => "system" as const,
  );
  const systemDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemPrefersDark,
    () => false,
  );

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Keep the DOM in sync with the resolved theme.
  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
    preferenceListeners.forEach((listener) => listener());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
