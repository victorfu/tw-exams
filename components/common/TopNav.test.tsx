import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { resetNavigation, setLocation } from "../../testing/nextNavigation";
import { TopNav } from "./TopNav";

let container: HTMLDivElement;
let root: Root;

function link(label: string): HTMLAnchorElement {
  const found = [...container.querySelectorAll("a")].find((item) => item.textContent === label);
  if (!found) throw new Error(`link not found: ${label}`);
  return found;
}

beforeEach(() => {
  resetNavigation();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("TopNav", () => {
  it("links to both sections and marks the current one", () => {
    setLocation("/past-exams");
    act(() => root.render(<TopNav />));

    expect(link("考古題").getAttribute("href")).toBe("/past-exams");
    expect(link("考古題").getAttribute("aria-current")).toBe("page");
    expect(link("自製考卷").getAttribute("href")).toBe("/my-exams");
    expect(link("自製考卷").hasAttribute("aria-current")).toBe(false);
  });

  it("lists 考古題 first", () => {
    act(() => root.render(<TopNav />));

    expect([...container.querySelectorAll("a")].map((item) => item.textContent)).toEqual(["考古題", "自製考卷"]);
  });

  it("treats nested pages as part of their section", () => {
    setLocation("/my-exams/sheets/new");
    act(() => root.render(<TopNav />));

    expect(link("自製考卷").getAttribute("aria-current")).toBe("page");
    expect(link("考古題").hasAttribute("aria-current")).toBe(false);
  });
});
