import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CropEditorToolbar } from "./CropEditorToolbar";

let container: HTMLDivElement;
let root: Root;

type Props = ComponentProps<typeof CropEditorToolbar>;

function render(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    title: "數學",
    onRename: vi.fn(),
    mode: "question",
    onModeChange: vi.fn(),
    status: "idle",
    onRetry: vi.fn(),
    appendHint: null,
    onCancelAppend: vi.fn(),
    onDeleteSelection: null,
    ...overrides,
  };
  act(() => root.render(<CropEditorToolbar {...props} />));
  return props;
}

function titleInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="來源標題"]');
  if (!input) throw new Error("title input missing");
  return input;
}

function keyDown(target: EventTarget, init: KeyboardEventInit): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CropEditorToolbar", () => {
  it("leaves the title field when Enter is pressed", () => {
    render();
    const title = titleInput();
    act(() => title.focus());

    keyDown(title, { key: "Enter", keyCode: 13 });
    expect(document.activeElement).not.toBe(title);
  });

  // 注音選字／確認組字的 Enter 不能讓欄位失焦：焦點掉到 <body> 後，
  // 裁題畫面的 Backspace 快捷鍵會把選取中的題目刪掉。
  it.each([
    // macOS Chrome／Edge：組字中的 keydown
    ["isComposing", { isComposing: true }],
    // macOS／iPadOS Safari：compositionend 先送出，keydown 的 isComposing 已是 false
    ["keyCode 229 after compositionend", { isComposing: false }],
  ])("keeps focus on the title field for an IME Enter (%s)", (_label, init) => {
    render();
    const title = titleInput();
    act(() => title.focus());

    keyDown(title, { key: "Enter", keyCode: 229, ...init });
    expect(document.activeElement).toBe(title);
  });
});
