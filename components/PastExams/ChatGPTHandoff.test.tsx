import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import { ChatGPTHandoff } from "./ChatGPTHandoff";
import { absoluteUrl } from "../../lib/site";
import { examFileUrl } from "../../lib/pastExams/fileUrl";

const exam = makeExam({ file: "pdf/考卷 1.pdf", answer: { file: "pdf/答案 1.pdf", format: "pdf", pages: 1, bytes: 20 } });
let container: HTMLDivElement;
let root: Root;
const copy = vi.fn();
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  copy.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<ChatGPTHandoff exams={[exam]} collections={[MATH_5A]} onClose={() => {}} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const prompt = () => container.querySelector<HTMLTextAreaElement>('textarea[readonly]')!;
const copyButton = () => [...container.querySelectorAll("button")].find((button) => button.textContent === "複製提示詞")!;
it("copies formal encoded links and includes answers only when checked", async () => {
  expect(prompt().value).toContain(absoluteUrl(examFileUrl(exam.file)));
  expect(prompt().value).not.toContain("解答：");
  const task = container.querySelector<HTMLTextAreaElement>("textarea:not([readonly])")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(task, "請比較難度");
    task.dispatchEvent(new Event("input", { bubbles: true }));
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
  expect(prompt().value).toContain("請比較難度");
  expect(prompt().value).toContain(absoluteUrl(examFileUrl(exam.answer!.file)));
  expect(container.querySelectorAll('a[download]')).toHaveLength(2);
  await act(async () => copyButton().click());
  expect(copy).toHaveBeenCalledWith(prompt().value);
  expect(container.textContent).toContain("已複製");
  expect(container.querySelector('a[target="_blank"]')?.getAttribute("href")).toBe("https://chatgpt.com/");
});
it("selects the full prompt for manual copying when the clipboard is unavailable", async () => {
  copy.mockRejectedValue(new Error("denied"));
  await act(async () => copyButton().click());
  expect(container.textContent).toContain("手動複製");
  expect(document.activeElement).toBe(prompt());
  expect(prompt().selectionEnd).toBe(prompt().value.length);
});
