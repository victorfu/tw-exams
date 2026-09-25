import { act, useEffect, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeContextValue } from "./ThemeContextType";

let container: HTMLDivElement;
let root: Root;
let latest: ThemeContextValue | null = null;
let ThemeProvider: ComponentType<{ children: ReactNode }>;
let ThemeToggle: ComponentType;

/** 可控制的 prefers-color-scheme（jsdom 沒有 matchMedia）。 */
function mockSystemTheme(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    setDark(next: boolean) {
      dark = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

/** 模擬封鎖網站資料：連讀取 window.localStorage 都會丟 SecurityError。 */
function blockStorage() {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
}

async function renderToggle() {
  // ThemeContext 在模組層記住偏好；每個測試重新載入，互不影響。
  vi.resetModules();
  ({ ThemeProvider } = await import("./ThemeContext"));
  ({ ThemeToggle } = await import("../components/common/ThemeToggle"));
  const { useTheme } = await import("../hooks/useTheme");
  function Probe() {
    const value = useTheme();
    useEffect(() => {
      latest = value;
    });
    return null;
  }
  act(() =>
    root.render(
      <ThemeProvider>
        <ThemeToggle />
        <Probe />
      </ThemeProvider>,
    ),
  );
}

function toggle() {
  act(() => container.querySelector("button")!.click());
}

function dataTheme() {
  return document.documentElement.getAttribute("data-theme");
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.setAttribute("data-theme", "paopaolight");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("ThemeProvider", () => {
  it("toggles and persists the theme", async () => {
    mockSystemTheme(false);
    await renderToggle();
    expect(dataTheme()).toBe("paopaolight");

    toggle();
    expect(dataTheme()).toBe("paopaodark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("ollie-theme")).toBe("dark");
    expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("切換至淺色模式");
  });

  it("picks up a theme saved by another tab", async () => {
    mockSystemTheme(false);
    await renderToggle();

    localStorage.setItem("ollie-theme", "dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "ollie-theme", newValue: "dark" }));
    });
    expect(dataTheme()).toBe("paopaodark");
  });

  describe("when localStorage throws", () => {
    it("still toggles for the session when site data is blocked", async () => {
      mockSystemTheme(false);
      blockStorage();
      await renderToggle();
      expect(dataTheme()).toBe("paopaolight");

      toggle();
      expect(dataTheme()).toBe("paopaodark");
      expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("切換至淺色模式");

      toggle();
      expect(dataTheme()).toBe("paopaolight");
    });

    it("still toggles for the session when storage is full", async () => {
      mockSystemTheme(false);
      localStorage.setItem("ollie-theme", "light");
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
      await renderToggle();
      expect(dataTheme()).toBe("paopaolight");

      toggle();
      expect(dataTheme()).toBe("paopaodark");
    });
  });

  describe("following the OS theme", () => {
    it("follows OS changes again after toggling back to the OS theme", async () => {
      const system = mockSystemTheme(false);
      await renderToggle();

      toggle();
      expect(latest?.theme).toBe("dark");
      toggle();
      // 切回和系統相同的主題 = 回到「跟隨系統」。
      expect(latest?.theme).toBe("system");
      expect(localStorage.getItem("ollie-theme")).toBe("system");
      expect(dataTheme()).toBe("paopaolight");

      system.setDark(true);
      expect(dataTheme()).toBe("paopaodark");
    });

    it("keeps a choice that differs from the OS theme", async () => {
      const system = mockSystemTheme(true);
      await renderToggle();
      expect(dataTheme()).toBe("paopaodark");

      toggle();
      expect(latest?.theme).toBe("light");
      expect(localStorage.getItem("ollie-theme")).toBe("light");

      system.setDark(false);
      system.setDark(true);
      expect(dataTheme()).toBe("paopaolight");
    });

    it("goes back to the OS theme from a saved explicit choice", async () => {
      mockSystemTheme(true);
      localStorage.setItem("ollie-theme", "light");
      await renderToggle();
      expect(dataTheme()).toBe("paopaolight");

      toggle();
      expect(latest?.theme).toBe("system");
      expect(dataTheme()).toBe("paopaodark");
    });

    it("returns to the OS theme even when localStorage is blocked", async () => {
      const system = mockSystemTheme(false);
      blockStorage();
      await renderToggle();

      toggle();
      expect(latest?.theme).toBe("dark");
      toggle();
      expect(latest?.theme).toBe("system");

      system.setDark(true);
      expect(dataTheme()).toBe("paopaodark");
    });
  });
});
