import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useSignedPageUrls: vi.fn() }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: mocks.useSignedPageUrls }));
vi.mock("./QuestionCrop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./QuestionCrop")>();
  return { ...actual, QuestionCrop: vi.fn(actual.QuestionCrop) };
});

import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { QuestionCrop } from "./QuestionCrop";
import { QuestionPicker } from "./QuestionPicker";

let container: HTMLDivElement;
let root: Root;

const at = (second: number) => new Date(`2026-09-01T00:00:0${second}Z`);
const bank = [
  makeQuestion({ id: "m1", subject: "math", createdAt: at(1) }),
  makeQuestion({ id: "m2", subject: "math", createdAt: at(2) }),
  makeQuestion({ id: "c1", subject: "chinese", createdAt: at(3) }),
];
const sources = [makeSource()];

function cards(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button[data-question-id]")];
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.startsWith(label));
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

function render(onAdd = vi.fn(), excludeIds = new Set(["m2"]), isOpen = true) {
  act(() =>
    root.render(
      <QuestionPicker
        isOpen={isOpen}
        bank={bank}
        sources={sources}
        excludeIds={excludeIds}
        onAdd={onAdd}
        onClose={vi.fn()}
      />,
    ),
  );
  return onAdd;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.useSignedPageUrls.mockReturnValue({ urls: {}, failed: false, refresh: vi.fn() });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("QuestionPicker", () => {
  it("hides questions that are already on the sheet", () => {
    render();
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["m1", "c1"]);
  });

  it("keeps the cards while the dialog closes", () => {
    const excludeIds = new Set(["m2"]);
    render(vi.fn(), excludeIds, true);
    // 關閉動畫還在播，卡片一拿掉對話框就會先縮成只剩標題
    render(vi.fn(), excludeIds, false);
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["m1", "c1"]);
  });

  it("does not re-render the cards when only the parent re-renders", () => {
    const excludeIds = new Set(["m2"]);
    for (const isOpen of [false, true]) {
      render(vi.fn(), excludeIds, isOpen);
      vi.mocked(QuestionCrop).mockClear();
      // 組卷頁每打一個字都會帶著新的 onAdd/onClose 重新渲染挑題視窗
      render(vi.fn(), excludeIds, isOpen);
      expect(QuestionCrop).not.toHaveBeenCalled();
    }

    act(() => cards()[0].click());
    expect(QuestionCrop).toHaveBeenCalled();
  });

  it("filters by subject", () => {
    render();
    act(() => button("國語").click());
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["c1"]);
  });

  it("adds the selected questions in display order", () => {
    const onAdd = render();
    const addButton = button("加入");
    expect(addButton.disabled).toBe(true);

    act(() => cards()[1].click());
    act(() => cards()[0].click());
    expect(button("加入").textContent).toBe("加入 2 題");

    act(() => button("加入").click());
    expect(onAdd.mock.calls[0][0].map((question: { id: string }) => question.id)).toEqual(["m1", "c1"]);
  });

  it("keeps the image retry outside the selection toggle", () => {
    const refresh = vi.fn();
    mocks.useSignedPageUrls.mockReturnValue({
      urls: { [makePage().storagePath]: "blob:page-0" },
      failed: false,
      refresh,
    });
    render();
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });

    // <button> 裡不能再放 <button>：重試要是切換按鈕的兄弟，而不是子孫
    expect(container.querySelector("button[data-question-id] button")).toBeNull();
    expect(cards()[0].textContent).toBe("數學・四上數學月考");

    act(() => button("重試").click());
    expect(refresh).toHaveBeenCalledWith(makePage().storagePath);
    expect(cards()[0].getAttribute("aria-pressed")).toBe("false");

    act(() => cards()[0].click());
    expect(cards()[0].getAttribute("aria-pressed")).toBe("true");
  });
});
