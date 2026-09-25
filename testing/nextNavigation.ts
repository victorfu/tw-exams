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

/**
 * 像 App Router 一樣，讓 window.history.pushState／replaceState 更新
 * usePathname／useSearchParams。用 vi.restoreAllMocks() 還原。
 */
export function followHistory(): void {
  for (const method of ["pushState", "replaceState"] as const) {
    vi.spyOn(window.history, method).mockImplementation((_data, _unused, url) => {
      if (url != null) setLocation(String(url), navigation.params);
    });
  }
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
