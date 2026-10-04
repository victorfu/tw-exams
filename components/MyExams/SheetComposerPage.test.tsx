import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BankQuestion, ExamSheet, QuestionSource } from "../../types/questionBank";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { navigation, resetNavigation, setLocation } from "../../testing/nextNavigation";
const mocks = vi.hoisted(() => ({
  bank: { sources: [] as QuestionSource[], questions: [] as BankQuestion[], sheets: [] as ExamSheet[], loading: false, error: null, reload: vi.fn() },
  createSheet: vi.fn(), updateSheet: vi.fn(),
}));
vi.mock("../../hooks/useQuestionBank", () => ({ useQuestionBank: () => mocks.bank }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: () => ({ urls: {}, refresh: vi.fn() }) }));
vi.mock("../../services/examSheetService", () => ({ createSheet: mocks.createSheet, updateSheet: mocks.updateSheet }));
import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { createSelectionDraft, readSelectionDraft, resetWorkspaceState, toggleQuestion, useWorkspaceSelection } from "./workspaceState";
import SheetComposerPage from "./SheetComposerPage";

let root: Root;
let container: HTMLDivElement;
function SelectionProbe() {
  const selection = useWorkspaceSelection();
  return <output data-testid="selection">{selection.ids.join(",")}</output>;
}
function render() { act(() => root.render(<><SheetComposerPage /><SelectionProbe /></>)); }
function saveButton() { return [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === "儲存並列印")!; }
const rowIds = () => [...container.querySelectorAll<HTMLElement>("li[data-question-id]")].map((item) => item.dataset.questionId);
beforeEach(() => {
  resetNavigation(); resetWorkspaceState();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.bank.sources = [makeSource()];
  mocks.bank.questions = [makeQuestion({ id: "a" }), makeQuestion({ id: "b" })];
  mocks.bank.sheets = [];
  mocks.createSheet.mockReset().mockResolvedValue({ id: "saved" });
  mocks.updateSheet.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("selection to composer", () => {
  it("resolves in selection order, skips missing sources/questions and takes priority over practice", () => {
    mocks.bank.questions.push(makeQuestion({ id: "orphan", sourceId: "deleted" }));
    const token = createSelectionDraft(["b", "orphan", "missing", "a"], "/my-exams?subject=math&search=test");
    setLocation(`/my-exams/sheets/new?selection=${token}&practice=1&datasetId=other`);
    render();
    expect(rowIds()).toEqual(["b", "a"]);
    expect(container.textContent).toContain("有 2 題已從題庫刪除");
    expect(container.querySelector('a[aria-label="返回自製考卷"]')?.getAttribute("href")).toBe("/my-exams?subject=math&search=test");
    expect(mocks.createSheet).not.toHaveBeenCalled();
  });

  it("retains the draft and selected questions on failed save, clears them only on success", async () => {
    toggleQuestion("b"); toggleQuestion("a");
    const token = createSelectionDraft(["b", "a"], "/my-exams");
    setLocation(`/my-exams/sheets/new?selection=${token}`);
    mocks.createSheet.mockRejectedValueOnce(new Error("offline"));
    render();
    await act(async () => saveButton().click());
    expect(rowIds()).toEqual(["b", "a"]);
    expect(container.textContent).toContain("儲存失敗");
    expect(readSelectionDraft(token)?.ids).toEqual(["b", "a"]);
    expect(container.querySelector("output")?.textContent).toBe("b,a");
    await act(async () => saveButton().click());
    expect(mocks.createSheet).toHaveBeenLastCalledWith(expect.objectContaining({ questionIds: ["b", "a"] }));
    expect(readSelectionDraft(token)).toBeUndefined();
    expect(container.querySelector("output")?.textContent).toBe("");
    expect(navigation.push).toHaveBeenCalledWith("/my-exams/sheets/saved/print");
  });

  it("shows recovery for expired and entirely missing selections", () => {
    setLocation("/my-exams/sheets/new?selection=unknown"); render();
    expect(container.textContent).toContain("這次選題已失效");
    const token = createSelectionDraft(["missing"], "/my-exams?source=source-1");
    act(() => setLocation(`/my-exams/sheets/new?selection=${token}`));
    expect(container.textContent).toContain("選取的題目已不存在");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/my-exams?source=source-1");
    expect(saveButton()).toBeUndefined();
  });

  it("keeps manual, practice and edit entry points working", () => {
    setLocation("/my-exams/sheets/new"); render();
    expect(rowIds()).toEqual([]);
    mocks.bank.sources = [makeSource({ pastExam: { examId: "exam", datasetId: "dataset", examType: "midterm", academicYear: 114 } })];
    act(() => setLocation("/my-exams/sheets/new?practice=1&datasetId=dataset&count=1"));
    expect(rowIds()).toHaveLength(1);
    mocks.bank.sheets = [{ id: "sheet", title: "Existing", userId: "public", questionIds: ["b", "a"], createdAt: new Date(), updatedAt: new Date() }];
    act(() => setLocation("/my-exams/sheets/sheet/edit?selection=invalid", { id: "sheet" }));
    expect(rowIds()).toEqual(["b", "a"]);
  });
});
