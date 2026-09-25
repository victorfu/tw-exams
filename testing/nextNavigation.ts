import { useSyncExternalStore } from "react";
import { vi } from "vitest";

/**
 * 測試用的 next/navigation 替身：元件在 jsdom 裡沒有 App Router 可以接。
 * 用法：
 *   vi.mock("next/navigation", async () =>
 *     (await import("../../testing/nextNavigation")).nextNavigationModule);
 */
export const navigation = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  params: {} as Record<string, string>,
  url: new URL("http://localhost/"),
};

let searchParams = new URLSearchParams();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 設定目前網址（路徑、query，可相對於目前網址）與動態路由參數；已渲染的元件會跟著更新。 */
export function setLocation(path: string, params: Record<string, string> = {}): void {
  navigation.url = new URL(path, navigation.url);
  navigation.params = params;
  searchParams = new URLSearchParams(navigation.url.search);
  listeners.forEach((listener) => listener());
}

export function resetNavigation(): void {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.back.mockReset();
  setLocation("/");
}

/** followHistory() 模擬的瀏覽紀錄（最後一筆是目前這頁）。 */
export const historyEntries: { state: unknown; url: string }[] = [];

/**
 * 像 App Router 一樣，讓 window.history 的 pushState／replaceState／back 更新
 * usePathname／useSearchParams，並模擬 history.state 與瀏覽紀錄。用 vi.restoreAllMocks() 還原。
 */
export function followHistory(): void {
  historyEntries.splice(0, historyEntries.length, { state: null, url: navigation.url.href });
  const go = (url: string | URL | null | undefined) => {
    if (url != null) setLocation(String(url), navigation.params);
    return navigation.url.href;
  };
  vi.spyOn(window.history, "pushState").mockImplementation((state, _unused, url) => {
    historyEntries.push({ state, url: go(url) });
  });
  vi.spyOn(window.history, "replaceState").mockImplementation((state, _unused, url) => {
    historyEntries[historyEntries.length - 1] = { state, url: go(url) };
  });
  vi.spyOn(window.history, "back").mockImplementation(() => {
    if (historyEntries.length < 2) return;
    historyEntries.pop();
    go(historyEntries[historyEntries.length - 1].url);
  });
  vi.spyOn(window.history, "state", "get").mockImplementation(() => historyEntries[historyEntries.length - 1].state);
}

const router = {
  push: (href: string) => navigation.push(href),
  replace: (href: string) => navigation.replace(href),
  back: () => navigation.back(),
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
};

export const nextNavigationModule = {
  useRouter: () => router,
  useParams: () => navigation.params,
  usePathname: () => useSyncExternalStore(subscribe, () => navigation.url.pathname),
  useSearchParams: () => useSyncExternalStore(subscribe, () => searchParams),
};
