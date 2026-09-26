import { useSyncExternalStore } from "react";

/** 與 Tailwind 的 md 斷點一致：桌機是左右分割，手機是全螢幕預覽層。 */
const DESKTOP_QUERY = "(min-width: 48rem)";

export function isDesktop(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia(DESKTOP_QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  const query = typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY) : null;
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** 伺服器輸出與 hydration 時當成桌機，之後才依實際寬度切換。 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktop, () => true);
}
