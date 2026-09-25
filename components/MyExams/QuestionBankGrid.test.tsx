import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { resetNavigation } from "../../testing/nextNavigation";

const mocks = vi.hoisted(() => ({ useSignedPageUrls: vi.fn() }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: mocks.useSignedPageUrls }));

import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { QuestionBankGrid } from "./QuestionBankGrid";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetNavigation();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  mocks.useSignedPageUrls.mockReturnValue({ urls: {}, failed: false, refresh: vi.fn() });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderGrid(questions = [
  makeQuestion({ id: "m1", subject: "math" }),
  makeQuestion({ id: "m2", subject: "math" }),
  makeQuestion({ id: "c1", subject: "chinese" }),
]) {
  act(() =>
    root.render(
      <QuestionBankGrid sources={[makeSource()]} questions={questions} onUpload={vi.fn()} />,
    ),
  );
}

function chip(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.startsWith(label),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`chip not found: ${label}`);
  return button;
}

describe("QuestionBankGrid", () => {
  it("shows subject counts and filters the cards", () => {
    renderGrid();
    expect(chip("全部").textContent).toBe("全部 3");
    expect(chip("數學").textContent).toBe("數學 2");
    expect(container.querySelectorAll("li")).toHaveLength(3);

    act(() => chip("國語").click());
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("links each card to its question in the crop editor", () => {
    renderGrid([makeQuestion({ id: "m1" })]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/my-exams/sources/source-1?q=m1");
  });

  it("keeps the image retry outside the card link", () => {
    const refresh = vi.fn();
    mocks.useSignedPageUrls.mockReturnValue({
      urls: { [makePage().storagePath]: "blob:page-0" },
      failed: false,
      refresh,
    });
    renderGrid([makeQuestion({ id: "m1" })]);
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });

    // <a> 裡不能放 <button>：重試要是連結的兄弟，而不是子孫
    expect(container.querySelector("a button")).toBeNull();
    expect(container.querySelector("a")?.textContent).toBe("數學四上數學月考");

    const retry = [...container.querySelectorAll("button")].find((item) => item.textContent === "重試");
    act(() => retry?.click());
    expect(refresh).toHaveBeenCalledWith(makePage().storagePath);
  });

  it("shows an upload call to action when the bank is empty", () => {
    renderGrid([]);
    expect(container.textContent).toContain("題庫還是空的");
  });
});
