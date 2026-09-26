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
import { DARK_QUERY, THEME_STORAGE_KEY } from "./themeInit";

const preferenceListeners = new Set<() => void>();
// The preference lives in memory and localStorage is only a best-effort copy,
// so the toggle still works for the session when storage is blocked or full.
let preference: ThemePreference | null = null;

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

const getPreference = (): ThemePreference => {
  if (preference === null) preference = readStoredPreference();
  return preference;
};

const subscribePreference = (listener: () => void) => {
  // Keep other tabs in sync. A null key means another tab cleared storage.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    preference = readStoredPreference();
    listener();
  };
  preferenceListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
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

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Server snapshots are the defaults; the real values arrive right after
  // hydration, so server and client markup always match.
  const theme = useSyncExternalStore(
    subscribePreference,
    getPreference,
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
    preference = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
    preferenceListeners.forEach((listener) => listener());
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    // Toggling to the OS theme goes back to "system", so later OS changes are
    // followed again; only a theme that differs from the OS is kept explicitly.
    const systemTheme: ResolvedTheme = systemDark ? "dark" : "light";
    setTheme(next === systemTheme ? "system" : next);
  }, [resolvedTheme, systemDark, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
