import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { navigation, resetNavigation, setLocation } from "../../testing/nextNavigation";

import type { BankQuestion, QuestionSource } from "../../types/questionBank";
import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { resetWorkspaceState } from "./workspaceState";

const mocks = vi.hoisted(() => ({
  bank: {
    sources: [] as QuestionSource[],
    questions: [] as BankQuestion[],
    sheets: [],
    loading: false,
    error: null as string | null,
    reload: vi.fn(),
  },
}));

vi.mock("../../hooks/useQuestionBank", () => ({ useQuestionBank: () => mocks.bank }));
// 以下只是不讓子元件載入 Firebase／Supabase／PDF；這些測試用不到它們。
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));
vi.mock("../../services/questionSourceService", () => ({ deleteSource: vi.fn() }));
vi.mock("../../services/examSheetService", () => ({ deleteSheet: vi.fn() }));
vi.mock("./SourceUploadDialog", () => ({ SourceUploadDialog: () => null }));

import MyExamsPage from "./MyExamsPage";

let container: HTMLDivElement;
let root: Root;

function renderPage() {
  act(() =>
    root.render(
      <MyExamsPage />,
    ),
  );
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.startsWith(label),
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

beforeEach(() => {
  resetNavigation();
  resetWorkspaceState();
  mocks.bank.sources = [];
  mocks.bank.questions = [];
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  mocks.bank.loading = false;
  mocks.bank.error = null;
  mocks.bank.reload.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("MyExamsPage", () => {
  it("shows the empty state when the bank is empty", () => {
    renderPage();
    expect(container.textContent).toContain("題庫還是空的");
  });

  it("shows only the error when loading fails", () => {
    mocks.bank.error = "讀取題庫失敗";
    renderPage();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("讀取題庫失敗");
    expect(container.textContent).not.toContain("題庫還是空的");
  });

  it("switches tabs with a history entry and without scrolling to the top", () => {
    renderPage();
    act(() => button("來源檔案").click());
    expect(navigation.push).toHaveBeenLastCalledWith("/my-exams?tab=sources", { scroll: false });
    act(() => button("題庫").click());
    expect(navigation.push).toHaveBeenLastCalledWith("/my-exams", { scroll: false });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("retries from the error", () => {
    mocks.bank.error = "讀取題庫失敗";
    renderPage();
    act(() => button("重試").click());
    expect(mocks.bank.reload).toHaveBeenCalledTimes(1);
  });
});


describe("workspace guidance", () => {
  it("prioritizes the most recently updated source when there are no valid questions", () => {
    mocks.bank.sources = [makeSource(), makeSource({ id: "latest", title: "New", updatedAt: new Date("2026-10-01") })];
    mocks.bank.questions = [makeQuestion({ sourceId: "missing" })];
    renderPage();
    expect(container.querySelector("header a.btn-primary")?.getAttribute("href")).toContain("/sources/latest?");
    expect(container.textContent).toContain("尚有 2 份來源未框題");
    expect(container.textContent).toContain("題庫（0）");
  });
  it("prioritizes composition once valid questions exist", () => {
    mocks.bank.sources = [makeSource()]; mocks.bank.questions = [makeQuestion()];
    renderPage();
    expect(container.querySelector("header a.btn-primary")?.textContent).toBe("組新考卷");
    expect(container.textContent).toContain("題庫（1）");
    expect(container.textContent).not.toContain("來源未框題");
    act(() => setLocation("/my-exams?tab=sheets"));
    expect(container.textContent).toContain("組第一份考卷");
  });
  it("does not send users with no questions into the empty composer", () => {
    setLocation("/my-exams?tab=sheets"); renderPage();
    expect(container.textContent).toContain("匯入照片／PDF");
    expect(container.querySelector('a[href="/my-exams/sheets/new"]')).toBeNull();
  });
});
