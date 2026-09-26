import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Next 實際包住 error.tsx 的 boundary；重試按鈕拿到的 retry() 就是它給的。
import {
  ErrorBoundaryHandler,
  type ErrorComponent,
} from "next/dist/client/components/error-boundary";

vi.mock("next/navigation", async () => (await import("../testing/nextNavigation")).nextNavigationModule);
import { resetNavigation, setLocation } from "../testing/nextNavigation";
import { logger } from "../utils/logger";

import RouteError from "./error";
import AppGroupError from "./(app)/error";

let container: HTMLDivElement;
let root: Root;

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

beforeEach(() => {
  resetNavigation();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  // 錯誤畫面會把錯誤記下來；不讓它洗版。
  vi.spyOn(logger, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  // React 預設也會把被 boundary 接住的錯誤印出來，這裡關掉。
  root = createRoot(container, { onCaughtError: () => {} });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("route error boundary", () => {
  it("shows a Chinese fallback and logs the error", () => {
    const error = new Error("pages[pageIndex] is undefined");
    act(() => root.render(<RouteError error={error} retry={vi.fn()} />));

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("發生錯誤");
    expect(alert?.textContent).toContain("重新整理頁面會全部清空");
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("retries in place instead of reloading the document", () => {
    setLocation("/my-exams/sources/abc", { id: "abc" });
    let shouldThrow = true;
    function FlakyPage() {
      if (shouldThrow) throw new Error("boom");
      return <p>這一頁的題目</p>;
    }

    act(() =>
      root.render(
        <ErrorBoundaryHandler
          pathname="/my-exams/sources/abc"
          errorComponent={RouteError as ErrorComponent}
        >
          <FlakyPage />
        </ErrorBoundaryHandler>,
      ),
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    // 內建的 global-error 是用 <form> submit 重新載入整頁，記憶體裡的題庫會跟著清空。
    expect(container.querySelector("form")).toBeNull();
    expect(button("重試").type).toBe("button");

    shouldThrow = false;
    act(() => button("重試").click());

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("這一頁的題目");
  });

  it("links back to /my-exams from other pages", () => {
    setLocation("/my-exams/sheets/abc/edit", { id: "abc" });
    act(() => root.render(<RouteError error={new Error("boom")} retry={vi.fn()} />));

    const link = container.querySelector<HTMLAnchorElement>('a[href="/my-exams"]');
    expect(link?.textContent).toBe("返回自製考卷");
  });

  it("offers only 重試 on /my-exams itself, where the link would not leave the error", () => {
    setLocation("/my-exams");
    act(() => root.render(<RouteError error={new Error("boom")} retry={vi.fn()} />));

    expect(container.querySelector('a[href="/my-exams"]')).toBeNull();
    expect(button("重試")).toBeDefined();
  });

  it("uses the same fallback under the app layout so the top bar stays", () => {
    expect(AppGroupError).toBe(RouteError);
  });
});
