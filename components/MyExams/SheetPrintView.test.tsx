import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BankQuestion, ExamSheet, QuestionSource } from "../../types/questionBank";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { resetNavigation, setLocation } from "../../testing/nextNavigation";

const mocks = vi.hoisted(() => ({
  bank: {
    sources: [] as QuestionSource[],
    questions: [] as BankQuestion[],
    sheets: [] as ExamSheet[],
    loading: false,
    error: null as string | null,
    reload: () => {},
  },
  refresh: vi.fn(),
}));

vi.mock("../../hooks/useQuestionBank", () => ({ useQuestionBank: () => mocks.bank }));
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: { "p0.jpg": "https://signed/p0" }, failed: false, refresh: mocks.refresh }),
}));

import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { PRINT_PREFERENCES_KEY } from "./printSettings";
import SheetPrintView from "./SheetPrintView";

let container: HTMLDivElement;
let root: Root;

const FIXED_DATE = new Date("2026-09-01T00:00:00Z");

function makeSheet(questionIds: string[]): ExamSheet {
  return {
    id: "sheet-1",
    userId: "user-1",
    title: "期中考複習",
    questionIds,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  };
}

function render() {
  act(() => root.render(<SheetPrintView />));
}

function printButton(): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>("button.btn-primary.ml-auto");
  if (!found) throw new Error("print button not found");
  return found;
}

function retryButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
    (item) => item.textContent === "重試",
  );
}

function fire(image: Element | undefined, type: "load" | "error") {
  if (!image) throw new Error("image not found");
  act(() => {
    image.dispatchEvent(new Event(type));
  });
}

function imageOf(questionId: string): HTMLImageElement | undefined {
  return container.querySelector<HTMLImageElement>(`li[data-question-id="${questionId}"] img`) ?? undefined;
}

beforeEach(() => {
  resetNavigation();
  setLocation("/my-exams/sheets/sheet-1/print", { id: "sheet-1" });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.removeItem(PRINT_PREFERENCES_KEY);
  mocks.refresh.mockReset();
  mocks.bank.sources = [makeSource({ pages: [makePage({ storagePath: "p0.jpg" })] })];
  mocks.bank.questions = [makeQuestion({ id: "q1" }), makeQuestion({ id: "q2" })];
  mocks.bank.sheets = [makeSheet(["q1", "q2"])];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.removeItem(PRINT_PREFERENCES_KEY);
});

describe("SheetPrintView", () => {
  it("waits for every image before enabling print", () => {
    render();
    expect(printButton().textContent).toBe("圖片載入中 0/2");
    fire(imageOf("q1"), "load");
    fire(imageOf("q2"), "load");
    expect(printButton().disabled).toBe(false);
    expect(printButton().textContent).toContain("列印");
  });

  it("does not get stuck loading after retrying one of several questions on the same page", () => {
    render();
    fire(imageOf("q1"), "error");
    fire(imageOf("q2"), "error");
    expect(printButton().disabled).toBe(false);
    expect(retryButtons()).toHaveLength(2);

    // 只重試第 1 題：第 2 題還是失敗狀態（沒有 <img>，不會再觸發 load／error）
    act(() => retryButtons()[0].click());
    expect(mocks.refresh).toHaveBeenCalledWith("p0.jpg");
    expect(imageOf("q2")).toBeUndefined();
    expect(printButton().textContent).toBe("圖片載入中 0/2");

    fire(imageOf("q1"), "load");
    expect(printButton().disabled).toBe(false);
    expect(printButton().textContent).toContain("列印");
    expect(container.textContent).toContain("有 1 張圖片載入失敗");
  });

  it("does not show the 「大」 hint for a sheet with nothing to print", () => {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, JSON.stringify({ scale: "large" }));
    mocks.bank.sheets = [makeSheet([])];
    render();
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe("大");
    expect(container.textContent).not.toContain("「大」印出來和「標準」一樣");
  });
});
