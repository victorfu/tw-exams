/** 與 Tailwind 的 md 斷點一致：桌機是左右分割，手機是全螢幕預覽層。 */
const DESKTOP_QUERY = "(min-width: 48rem)";

export function isDesktop(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia(DESKTOP_QUERY).matches;
}
