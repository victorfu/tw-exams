import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { resetNavigation, setLocation } from "../../testing/nextNavigation";

const mocks = vi.hoisted(() => ({
  commitEditorChanges: vi.fn(),
  nextId: 0,
}));

vi.mock("../../services/bankQuestionService", () => ({
  commitEditorChanges: mocks.commitEditorChanges,
  newBankQuestionId: () => {
    mocks.nextId += 1;
    return `new-${mocks.nextId}`;
  },
}));
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));

import type { BankQuestion, SourcePage } from "../../types/questionBank";
import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { CropEditorWorkspace } from "./CropEditorWorkspace";

let container: HTMLDivElement;
let root: Root;

function renderWorkspace(
  entry = "/my-exams/sources/source-1",
  {
    pages = [makePage(), makePage({ storagePath: "p1.jpg" })],
    questions = [
      makeQuestion({ id: "q1", answer: "(1)", regions: [{ pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }] }),
      makeQuestion({ id: "q2", regions: [{ pageIndex: 1, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }] }),
    ],
  }: { pages?: SourcePage[]; questions?: BankQuestion[] } = {},
) {
  const source = makeSource({ pages });
  setLocation(entry, { id: "source-1" });
  act(() => root.render(<CropEditorWorkspace source={source} initialQuestions={questions} />));
  const overlay = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (overlay) {
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  }
}

function overlay(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!element) throw new Error("overlay missing");
  return element;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
  const EventType = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function draw(): void {
  pointer("pointerdown", overlay(), 20, 50);
  pointer("pointermove", overlay(), 120, 90);
  pointer("pointerup", overlay(), 120, 90);
}

function headings(): string[] {
  return [...container.querySelectorAll("article header span")].map((item) => item.textContent ?? "");
}

function answerInputs(): string[] {
  return [...container.querySelectorAll<HTMLInputElement>('article input[placeholder^="例如"]')].map(
    (input) => input.value,
  );
}

function pressKey(key: string, target: EventTarget = window): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function pressKeyWith(init: KeyboardEventInit, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function titleInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="來源標題"]');
  if (!input) throw new Error("title input missing");
  return input;
}

function buttonNamed(name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (button) => (button.getAttribute("aria-label") ?? button.textContent?.trim()) === name,
  );
}

function boxElement(key: string): Element {
  const element = container.querySelector(`[data-box-key="${key}"]`);
  if (!element) throw new Error(`box ${key} missing`);
  return element;
}

function lastCommit() {
  const [commit] = mocks.commitEditorChanges.mock.calls.at(-1) ?? [];
  return commit;
}

async function flushAutosave(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

beforeEach(() => {
  resetNavigation();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  // Pin "now" after the fixtures' FIXED_DATE (2026-09-01): a question drawn
  // "now" is created after q1/q2 and must sort after them (spec §6/§8.3 —
  // source-wide crop order, oldest first), regardless of which page it's
  // drawn on.
  vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
  mocks.commitEditorChanges.mockReset().mockResolvedValue(undefined);
  mocks.nextId = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("CropEditorWorkspace", () => {
  it("creates a question from a drag and autosaves it", async () => {
    renderWorkspace();
    expect(headings()).toEqual(["第 1 題"]);

    draw();
    // q2 (page 1, not shown here) is source-wide #2 by crop order; the newly
    // drawn question is created after both q1 and q2, so it is #3 even
    // though it's drawn on page 1's neighbour, page 0 (spec §6/§8.3).
    expect(headings()).toEqual(["第 1 題", "第 3 題"]);
    // Card order proves it's crop order, not draw position: the first card
    // is still q1 (its answer "(1)" survives), the new card is the empty one.
    expect(answerInputs()).toEqual(["(1)", ""]);
    expect(container.querySelector('[data-box-key="q:new-1:0"]')?.textContent).toContain("3");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.upserts.map((question: { id: string }) => question.id)).toEqual(["new-1"]);
    expect(commit.upserts[0]).toMatchObject({ subject: "math", answerSpace: "none", sourceId: "source-1" });
  });

  it("opens the page of the question given by ?q=", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q2");
    expect(container.textContent).toContain("這一頁的題目（1）");
    expect(container.querySelector('[data-box-key="q:q2:0"]')).not.toBeNull();
  });

  it("does not delete the selected question while typing in the answer field", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q1");
    const answer = container.querySelector<HTMLInputElement>('input[placeholder^="例如"]');
    if (!answer) throw new Error("answer input missing");
    pressKey("Backspace", answer);
    expect(headings()).toEqual(["第 1 題"]);

    pressKey("Backspace");
    expect(headings()).toEqual([]);
  });

  it("draws masks in mask mode and saves the source", async () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());
    draw();
    expect(headings()).toEqual(["第 1 題"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.source.pages[0].masks).toHaveLength(1);
  });

  it("deletes the selected mask with an on-screen button, for touch users without a keyboard", async () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());
    expect(buttonNamed("刪除選取的框")).toBeUndefined();

    draw(); // draws and selects a mask
    const deleteButton = buttonNamed("刪除選取的框");
    if (!deleteButton) throw new Error("delete button missing");
    act(() => deleteButton.click());

    expect(container.querySelector('[data-box-key="m:0"]')).toBeNull();
    expect(buttonNamed("刪除選取的框")).toBeUndefined();
    await flushAutosave();
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.source.pages[0].masks).toEqual([]);
  });

  it("offers a cancel button for 新增區塊 on another page, where the target card is not shown", () => {
    renderWorkspace();
    const appendButton = buttonNamed("新增區塊到第 1 題");
    if (!appendButton) throw new Error("append button missing");
    act(() => appendButton.click());
    expect(buttonNamed("取消新增區塊到第 1 題")).toBeDefined();

    const nextPage = buttonNamed("下一頁");
    act(() => nextPage?.click());
    expect(buttonNamed("取消新增區塊到第 1 題")).toBeUndefined(); // 第 1 題的卡片不在這一頁
    expect(container.textContent).not.toContain("Esc");

    const cancel = buttonNamed("取消");
    if (!cancel) throw new Error("cancel button missing");
    act(() => cancel.click());
    expect(container.textContent).not.toContain("新增區塊：");

    draw();
    expect(headings()).toEqual(["第 2 題", "第 3 題"]); // 畫的是新題目，不是接到第 1 題
  });

  it("does not delete a question card selected while in mask mode", () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());

    const article = container.querySelector("article");
    if (!article) throw new Error("card missing");
    act(() => article.click());

    pressKey("Backspace");
    expect(headings()).toEqual(["第 1 題"]);
  });

  it("does not delete a mask left selected after switching to question mode via 新增區塊", async () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());
    draw(); // draws and selects a mask

    const appendButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "新增區塊",
    );
    if (!appendButton) throw new Error("append button missing");
    act(() => appendButton.click());

    pressKey("Backspace");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.source.pages[0].masks).toHaveLength(1);
  });

  it("clears the append hint when the append-target question is deleted via keyboard", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q1");
    const appendButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "新增區塊",
    );
    if (!appendButton) throw new Error("append button missing");
    act(() => appendButton.click());
    expect(container.textContent).toContain("新增區塊：");

    const article = container.querySelector("article");
    if (!article) throw new Error("card missing");
    act(() => article.click());
    pressKey("Backspace");

    expect(container.textContent).not.toContain("新增區塊：");
  });

  it("still deletes a question whose box is deleted with the keyboard while it is being dragged", async () => {
    renderWorkspace();
    pointer("pointerdown", boxElement("q:q1:0"), 30, 15);
    pointer("pointermove", overlay(), 40, 25);
    pressKey("Delete");
    expect(container.querySelector('[data-box-key="q:q1:0"]')).toBeNull();
    pointer("pointermove", overlay(), 60, 45);
    pointer("pointerup", overlay(), 60, 45);
    await flushAutosave();

    expect(mocks.commitEditorChanges).toHaveBeenCalledTimes(1);
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.deleteIds).toEqual(["q1"]);
    expect(commit.upserts).toEqual([]);
  });

  it("keeps the next mask intact when the dragged mask is deleted mid-drag", async () => {
    const maskB = { x: 0.6, y: 0.6, w: 0.2, h: 0.2 };
    renderWorkspace(undefined, {
      pages: [makePage({ masks: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, maskB] }), makePage({ storagePath: "p1.jpg" })],
    });
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());

    pointer("pointerdown", boxElement("m:0"), 30, 20);
    pointer("pointermove", overlay(), 40, 30);
    pressKey("Delete");
    pointer("pointermove", overlay(), 50, 40);
    pointer("pointerup", overlay(), 50, 40);
    await flushAutosave();

    const [commit] = mocks.commitEditorChanges.mock.calls.at(-1) ?? [];
    expect(commit.source.pages[0].masks).toEqual([maskB]);
  });

  it("clears the selection when a region is removed from the card, so Delete cannot hit a shifted region", async () => {
    const regionA = { pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } };
    const regionB = { pageIndex: 0, box: { x: 0.1, y: 0.5, w: 0.3, h: 0.1 } };
    const regionC = { pageIndex: 1, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } };
    renderWorkspace(undefined, {
      questions: [makeQuestion({ id: "q1", regions: [regionA, regionB, regionC] })],
    });

    pointer("pointerdown", boxElement("q:q1:1"), 30, 55); // 選取 B
    pointer("pointerup", overlay(), 30, 55);
    const removeA = [...container.querySelectorAll("button")].find((button) => button.textContent === "移除");
    if (!removeA) throw new Error("remove button missing");
    act(() => removeA.click()); // 移除區塊 1（A）：B、C 往前遞補
    pressKey("Delete");
    await flushAutosave();

    const [commit] = mocks.commitEditorChanges.mock.calls.at(-1) ?? [];
    expect(commit.upserts.map((question: BankQuestion) => question.regions)).toEqual([[regionB, regionC]]);
    expect(commit.deleteIds).toEqual([]);
  });

  it("saves a title typed into the still-focused title field when the editor unmounts", async () => {
    renderWorkspace();
    const title = titleInput();
    act(() => title.focus());
    typeInto(title, "四上數學 第二次月考");
    expect(document.activeElement).toBe(title);

    // 瀏覽器「上一頁」：焦點還在欄位上就卸載，不會有 blur
    await act(async () => {
      root.unmount();
    });
    await flushAutosave();

    const [commit] = mocks.commitEditorChanges.mock.calls.at(-1) ?? [];
    expect(commit?.source?.title).toBe("四上數學 第二次月考");
  });

  it("falls back to the title from before editing when the title field is cleared", async () => {
    renderWorkspace();
    const title = titleInput();
    act(() => title.focus());
    typeInto(title, "四上");
    typeInto(title, "");
    act(() => title.blur());

    expect(title.value).toBe("四上數學月考");
    await flushAutosave();
    for (const [commit] of mocks.commitEditorChanges.mock.calls) {
      expect(commit.source?.title ?? "四上數學月考").toBe("四上數學月考");
    }
  });

  it("trims the title and shows the trimmed value after leaving the field", async () => {
    renderWorkspace();
    const title = titleInput();
    act(() => title.focus());
    typeInto(title, "  期末考  ");
    act(() => title.blur());

    expect(title.value).toBe("期末考");
    await flushAutosave();
    const [commit] = mocks.commitEditorChanges.mock.calls.at(-1) ?? [];
    expect(commit.source.title).toBe("期末考");
  });

  it.each([
    ["macOS Chrome/Edge", { isComposing: true }],
    ["Safari", { isComposing: false }],
  ])(
    "does not delete the selected question on Backspace after an IME Enter in the title field (%s)",
    async (_browser, init) => {
      renderWorkspace("/my-exams/sources/source-1?q=q1");
      const title = titleInput();
      act(() => title.focus());
      typeInto(title, "四上");
      // 按 Enter 確認注音選字
      act(() => {
        title.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true, ...init }),
        );
      });
      // 使用者以為打錯字接著按 Backspace：鍵盤事件送到目前有焦點的元素
      pressKey("Backspace", document.activeElement ?? document.body);
      await flushAutosave();

      expect(container.querySelector('[data-box-key="q:q1:0"]')).not.toBeNull();
      for (const [commit] of mocks.commitEditorChanges.mock.calls) {
        expect(commit.deleteIds).toEqual([]);
      }
    },
  );

  describe("keyboard", () => {
    function clickButton(name: string): void {
      const button = buttonNamed(name);
      if (!button) throw new Error(`button ${name} missing`);
      act(() => button.click());
    }

    it("adds a centred question box from the 新增框 button and selects it", async () => {
      renderWorkspace();
      clickButton("新增框");

      expect(headings()).toEqual(["第 1 題", "第 3 題"]);
      expect(boxElement("q:new-1:0").getAttribute("aria-pressed")).toBe("true");
      await flushAutosave();
      const box = lastCommit().upserts[0].regions[0].box;
      expect(box.x + box.w / 2).toBeCloseTo(0.5);
      expect(box.y + box.h / 2).toBeCloseTo(0.5);
    });

    it("adds a mask from the 新增框 button in mask mode", async () => {
      renderWorkspace();
      clickButton("遮蓋");
      clickButton("新增框");

      expect(boxElement("m:0").getAttribute("aria-pressed")).toBe("true");
      await flushAutosave();
      expect(lastCommit().source.pages[0].masks).toHaveLength(1);
      expect(headings()).toEqual(["第 1 題"]);
    });

    it("appends a region to the 新增區塊 target from the 新增框 button", async () => {
      renderWorkspace();
      clickButton("新增區塊到第 1 題");
      clickButton("新增框");

      expect(headings()).toEqual(["第 1 題"]);
      expect(boxElement("q:q1:1").getAttribute("aria-pressed")).toBe("true");
      expect(container.textContent).not.toContain("新增區塊：");
      await flushAutosave();
      expect(lastCommit().upserts[0].regions).toHaveLength(2);
    });

    it("moves the selected box with the arrow keys and resizes it with Alt, autosaving the result", async () => {
      renderWorkspace("/my-exams/sources/source-1?q=q1"); // q1：{ x: 0.1, y: 0.1, w: 0.3, h: 0.1 }
      const right = pressKeyWith({ key: "ArrowRight" });
      expect(right.defaultPrevented).toBe(true); // 不捲動頁面
      pressKeyWith({ key: "ArrowDown", shiftKey: true });
      pressKeyWith({ key: "ArrowRight", altKey: true });
      await flushAutosave();

      const box = lastCommit().upserts[0].regions[0].box;
      expect(box.x).toBeCloseTo(0.105);
      expect(box.y).toBeCloseTo(0.15);
      expect(box.w).toBeCloseTo(0.305);
      expect(box.h).toBeCloseTo(0.1);
    });

    it("moves the box focused with Tab", async () => {
      renderWorkspace();
      const box = boxElement("q:q1:0") as HTMLElement;
      act(() => box.focus());
      pressKeyWith({ key: "ArrowLeft" }, box);
      await flushAutosave();
      expect(lastCommit().upserts[0].regions[0].box.x).toBeCloseTo(0.095);
    });

    it("does not move the selected box while typing in a field or when nothing is selected", async () => {
      renderWorkspace("/my-exams/sources/source-1?q=q1");
      const answer = container.querySelector<HTMLInputElement>('input[placeholder^="例如"]');
      if (!answer) throw new Error("answer input missing");
      const inField = pressKeyWith({ key: "ArrowRight" }, answer);
      expect(inField.defaultPrevented).toBe(false);

      pressKey("Escape");
      const unselected = pressKeyWith({ key: "ArrowRight" });
      expect(unselected.defaultPrevented).toBe(false); // 沒有選取時照常捲動頁面
      await flushAutosave();
      expect(mocks.commitEditorChanges).not.toHaveBeenCalled();
    });

    it("does not move a question selected from its card while in mask mode", async () => {
      renderWorkspace();
      clickButton("遮蓋");
      clickButton("第 1 題");
      pressKeyWith({ key: "ArrowRight" });
      await flushAutosave();
      expect(mocks.commitEditorChanges).not.toHaveBeenCalled();
    });

    it("selects a question from a real button on its card", () => {
      renderWorkspace();
      const select = buttonNamed("第 1 題");
      if (!select) throw new Error("select button missing");
      expect(select.getAttribute("aria-pressed")).toBe("false");
      act(() => select.click());
      expect(buttonNamed("第 1 題")?.getAttribute("aria-pressed")).toBe("true");

      pressKey("Backspace");
      expect(headings()).toEqual([]);
    });

    it("names the card and its per-question buttons after the question", () => {
      const regionA = { pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } };
      const regionB = { pageIndex: 1, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } };
      renderWorkspace(undefined, { questions: [makeQuestion({ id: "q1", regions: [regionA, regionB] })] });

      expect(container.querySelector("article")?.getAttribute("aria-label")).toBe("第 1 題");
      expect(buttonNamed("移除第 1 題的區塊 1")?.textContent).toBe("移除");
      expect(buttonNamed("移除第 1 題的區塊 2")?.textContent).toBe("移除");
      expect(buttonNamed("新增區塊到第 1 題")?.textContent).toBe("新增區塊");

      act(() => buttonNamed("下一頁")?.click());
      expect(container.querySelector("article")?.getAttribute("aria-label")).toBe("第 1 題（續）");
    });
  });
});
