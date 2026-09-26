import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("../testing/nextNavigation")).nextNavigationModule);
import { resetNavigation, setLocation } from "../testing/nextNavigation";
import { logger } from "../utils/logger";

import GlobalError from "./global-error";

let root: Root | null = null;

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

beforeEach(() => {
  resetNavigation();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(logger, "error").mockImplementation(() => {});
  // jsdom 沒有 matchMedia；預設系統為淺色。
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  localStorage.clear();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("GlobalError", () => {
  it("renders its own zh-Hant document with the app's light theme by default", () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error("boom")} retry={vi.fn()} />);
    const doc = new DOMParser().parseFromString(`<!DOCTYPE html>${html}`, "text/html");

    expect(doc.documentElement.getAttribute("lang")).toBe("zh-Hant");
    expect(doc.documentElement.getAttribute("data-theme")).toBe("ollielight");
    expect(doc.body.querySelector('[role="alert"]')?.textContent).toContain("發生錯誤");
  });

  it("applies the saved theme and retries in place", () => {
    localStorage.setItem("ollie-theme", "dark");
    setLocation("/my-exams/sheets/abc/edit", { id: "abc" });
    const retry = vi.fn();

    // 取代根 layout 時，React 會接手整份 document 的 <html>／<body>。
    root = createRoot(document);
    act(() => root?.render(<GlobalError error={new Error("boom")} retry={retry} />));

    expect(document.documentElement.getAttribute("data-theme")).toBe("olliedark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.querySelector("form")).toBeNull();
    expect(document.querySelector('a[href="/my-exams"]')?.textContent).toBe("返回自製考卷");

    act(() => button("重試").click());
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
