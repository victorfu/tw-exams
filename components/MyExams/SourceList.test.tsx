import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: () => ({ urls: {}, refresh: vi.fn() }) }));
const mocks = vi.hoisted(() => ({ deleteSource: vi.fn() }));
vi.mock("../../services/questionSourceService", () => ({ deleteSource: mocks.deleteSource }));
import { makeSource, makeQuestion } from "../../testing/questionBankFixtures";
import { SourceList } from "./SourceList";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.deleteSource.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("shows first-page previews and accurate actions without claiming completion", () => {
  act(() => root.render(<SourceList sources={[makeSource(), makeSource({ id: "empty", title: "Empty" })]} questions={[makeQuestion()]} onDeleted={vi.fn()} onUpload={vi.fn()} />));
  expect(container.querySelectorAll('[data-testid="question-crop-region"]')).toHaveLength(2);
  expect(container.querySelectorAll(".badge-warning")).toHaveLength(1);
  expect(container.textContent).toContain("開始框題");
  expect(container.textContent).toContain("繼續框題");
  expect(container.textContent).not.toContain("已完成");
  const href = container.querySelector("a")!.getAttribute("href")!;
  expect(new URL(href, "http://localhost").searchParams.get("returnTo")).toBe("/my-exams?tab=sources");
});
it("still deletes only after confirmation and then reloads", async () => {
  const onDeleted = vi.fn(); const source = makeSource();
  act(() => root.render(<SourceList sources={[source]} questions={[makeQuestion()]} onDeleted={onDeleted} onUpload={vi.fn()} />));
  act(() => container.querySelector<HTMLButtonElement>('button[aria-label="刪除 四上數學月考"]')!.click());
  expect(mocks.deleteSource).not.toHaveBeenCalled();
  const confirm = [...container.querySelectorAll("dialog button")].find((item) => item.textContent === "刪除") as HTMLButtonElement;
  await act(async () => confirm.click());
  expect(mocks.deleteSource).toHaveBeenCalledWith(source);
  expect(onDeleted).toHaveBeenCalledOnce();
});
