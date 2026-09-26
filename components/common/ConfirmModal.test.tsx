import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ConfirmModal", () => {
  it("has an accessible name and exposes an operation error", () => {
    act(() => {
      root.render(
        <ConfirmModal
          isOpen
          title="刪除這張考卷？"
          message="「期中考複習」會被刪除，題庫裡的題目不受影響。"
          errorMessage="刪除失敗，請重試"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    const titleId = dialog?.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId ?? "")?.textContent).toBe("刪除這張考卷？");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("刪除失敗");
  });

  it("handles native cancel and blocks it while deleting", () => {
    const onCancel = vi.fn();
    const render = (isLoading: boolean) => {
      act(() => {
        root.render(
          <ConfirmModal
            isOpen
            title="刪除這次上傳？"
            message="題目和所有頁面圖都會刪除，無法復原。"
            isLoading={isLoading}
            onConfirm={vi.fn()}
            onCancel={onCancel}
          />,
        );
      });
    };

    render(false);
    const dialog = container.querySelector<HTMLDialogElement>("dialog");
    const cancelEvent = new Event("cancel", { cancelable: true });
    act(() => dialog?.dispatchEvent(cancelEvent));
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    render(true);
    const loadingCancelEvent = new Event("cancel", { cancelable: true });
    act(() => dialog?.dispatchEvent(loadingCancelEvent));
    expect(loadingCancelEvent.defaultPrevented).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialog?.open).toBe(true);
  });
});
