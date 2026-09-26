"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY } from "@/contexts/themeInit";
import RouteError from "./error";
import "./globals.css";

type DaisyTheme = "paopaolight" | "paopaodark";

const subscribeNothing = () => () => {};

/** 和 THEME_INIT_SCRIPT 同樣的判斷；這裡沒有 ThemeProvider，也跑不到 <head> 裡的 script。 */
const readSavedTheme = (): DaisyTheme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const sysDark = window.matchMedia(DARK_QUERY).matches;
    const isDark = stored === "dark" || ((stored === "system" || !stored) && sysDark);
    return isDark ? "paopaodark" : "paopaolight";
  } catch {
    return "paopaolight";
  }
};

/**
 * 根 layout 本身出錯時取代它，所以要自己畫 <html>／<body>、自己載入 globals.css
 * 和套用主題；內容沿用 app/error.tsx 的錯誤畫面。
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // 伺服器與 hydration 時用預設的淺色，之後才換成儲存的主題，兩邊 markup 才對得上。
  const theme = useSyncExternalStore(subscribeNothing, readSavedTheme, () => "paopaolight" as const);

  return (
    <html lang="zh-Hant" data-theme={theme} className={theme === "paopaodark" ? "dark" : undefined}>
      <body>
        <title>發生錯誤 · 自製考卷</title>
        <RouteError error={error} retry={retry} />
      </body>
    </html>
  );
}
