import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
vi.mock("./PdfViewer", () => ({ PdfViewer: () => <div data-viewer /> }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: () => ({ urls: {}, refresh: vi.fn() }) }));
import { followHistory, navigation, resetNavigation, setLocation } from "../../testing/nextNavigation";
import { installObserverStubs } from "../../testing/observers";
import { makeCatalog, makeExam } from "../../testing/pastExamsFixtures";
import { makeSource } from "../../testing/questionBankFixtures";
import { mockStore, resetMockStore } from "../../services/mockStore";
import * as service from "../../services/bankQuestionService";
import { readSelectionDraft } from "../MyExams/workspaceState";
import { resetPastExamSelection } from "./selectionState";
import PastExamsPage from "./PastExamsPage";

const a = makeExam({ school: "A國小", id: "a" });
const b = makeExam({ school: "B國小", id: "b" });
let root: Root;
let container: HTMLDivElement;
function button(name: string) {
  const found = [...container.querySelectorAll("button")].find((item) => (item.getAttribute("aria-label") ?? item.textContent?.trim()) === name);
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function click(name: string) { await act(async () => button(name).click()); }
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetNavigation(); resetMockStore(); resetPastExamSelection(); installObserverStubs();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  for (const exam of [a, b]) mockStore.sources.set(exam.id, makeSource({ id: exam.id, title: exam.title,
    pastExam: { examId: exam.id, datasetId: exam.datasetId, academicYear: exam.academicYear, examType: exam.examType } }));
  setLocation(`/past-exams?c=${a.datasetId}&id=a`); followHistory();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  act(() => root.render(<PastExamsPage catalog={makeCatalog([a, b])} />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("collects across exams, preserves questions on removal, deletes frames, and composes only after saving", async () => {
  await click("框選題目");
  await click("新增框");
  // Arrow keys belong to the box editor, not exam navigation.
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(navigation.url.searchParams.get("id")).toBe("a");
  await click("下一份");
  expect(mockStore.questions.size).toBe(1);
  await click("框選題目");
  await click("新增框");
  await click("移出本次選題 · 第 1 題");
  expect(container.textContent).toContain("已選 1 題");
  await click("加入本次選題 · 第 1 題");
  await click("刪除選取的框");
  expect(container.textContent).toContain("已選 1 題");
  await click("新增框");
  await click("用這些題目組卷");
  const href = navigation.push.mock.calls.at(-1)![0] as string;
  const token = new URL(href, "https://local.invalid").searchParams.get("selection")!;
  const draft = readSelectionDraft(token)!;
  expect(draft.ids).toHaveLength(2);
  expect(draft.ids.every((id) => mockStore.questions.has(id))).toBe(true);
  expect(draft.returnTo).toContain("id=b");
  expect(mockStore.sources.size).toBe(2);
});
it("blocks exam changes and composing on save failure, then permits retry", async () => {
  const original = service.commitEditorChanges;
  const commit = vi.spyOn(service, "commitEditorChanges").mockRejectedValue(new Error("offline"));
  await click("框選題目"); await click("新增框");
  await click("下一份");
  expect(navigation.url.searchParams.get("id")).toBe("a");
  expect(container.textContent).toContain("儲存失敗，請重試後再離開");
  await click("用這些題目組卷");
  expect(navigation.push).not.toHaveBeenCalled();
  commit.mockImplementation(original);
  await click("下一份");
  expect(navigation.url.searchParams.get("id")).toBe("b");
  expect(mockStore.questions.size).toBe(1);
});

it("guards history filters and browser back while saving fails", async () => {
  vi.spyOn(service, "commitEditorChanges").mockRejectedValue(new Error("offline"));
  await click("框選題目"); await click("新增框");
  await click("收藏 0");
  expect(container.querySelector('[data-testid="crop-overlay"]')).not.toBeNull();
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
  expect(navigation.url.searchParams.get("id")).toBe("a");
  expect(container.querySelector('[data-testid="crop-overlay"]')).not.toBeNull();
});

it("does not edit a selected frame with keyboard shortcuts behind an open dialog", async () => {
  await click("框選題目"); await click("新增框");
  const dialog = document.createElement("dialog"); dialog.open = true; document.body.appendChild(dialog);
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
  expect(container.textContent).toContain("這一頁的題目（1）");
  dialog.remove();
});
