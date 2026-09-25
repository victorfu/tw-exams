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

/** 設定目前網址（路徑、query）與動態路由參數。 */
export function setLocation(path: string, params: Record<string, string> = {}): void {
  navigation.url = new URL(path, "http://localhost");
  navigation.params = params;
  searchParams = new URLSearchParams(navigation.url.search);
}

export function resetNavigation(): void {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.back.mockReset();
  setLocation("/");
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
  usePathname: () => navigation.url.pathname,
  useSearchParams: () => searchParams,
};
