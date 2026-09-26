import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installObserverStubs, resizeObservedElements } from "../../testing/observers";
import { overflowEdges, ScrollRow } from "./ScrollRow";

let container: HTMLDivElement;
let root: Root;

/** jsdom 沒有版面：替捲動列指定可見寬度與內容寬度。 */
function stubSize(element: HTMLElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
}

function row(): HTMLDivElement {
  return container.querySelector<HTMLDivElement>("[data-scroll-row]")!;
}

beforeEach(() => {
  installObserverStubs();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("overflowEdges", () => {
  it("reports which sides still have hidden content", () => {
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 100, scrollWidth: 100 })).toEqual({ start: false, end: false });
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 100, scrollWidth: 300 })).toEqual({ start: false, end: true });
    expect(overflowEdges({ scrollLeft: 100, clientWidth: 100, scrollWidth: 300 })).toEqual({ start: true, end: true });
    expect(overflowEdges({ scrollLeft: 200, clientWidth: 100, scrollWidth: 300 })).toEqual({ start: true, end: false });
  });
});

describe("ScrollRow", () => {
  function render() {
    act(() =>
      root.render(
        <ScrollRow aria-label="學年度">
          <button type="button">114</button>
          <button type="button" aria-pressed="true">
            108
          </button>
        </ScrollRow>,
      ),
    );
  }

  it("fades only the sides that can still scroll", () => {
    render();
    stubSize(row(), 100, 300);

    act(() => resizeObservedElements(100));
    expect(row().dataset.fadeStart).toBeUndefined();
    expect(row().dataset.fadeEnd).toBe("");

    act(() => {
      row().scrollLeft = 200;
      row().dispatchEvent(new Event("scroll"));
    });
    expect(row().dataset.fadeStart).toBe("");
    expect(row().dataset.fadeEnd).toBeUndefined();
  });

  it("turns a vertical mouse wheel into horizontal scrolling while the row can move", () => {
    render();
    stubSize(row(), 100, 300);

    const down = new WheelEvent("wheel", { deltaY: 60, cancelable: true });
    act(() => {
      row().dispatchEvent(down);
    });
    expect(row().scrollLeft).toBe(60);
    expect(down.defaultPrevented).toBe(true);

    // 已經捲到底：讓頁面照常往下捲
    row().scrollLeft = 200;
    const more = new WheelEvent("wheel", { deltaY: 60, cancelable: true });
    act(() => {
      row().dispatchEvent(more);
    });
    expect(more.defaultPrevented).toBe(false);
  });

  it("leaves the wheel alone when everything fits", () => {
    render();
    stubSize(row(), 300, 300);

    const wheel = new WheelEvent("wheel", { deltaY: 60, cancelable: true });
    act(() => {
      row().dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(false);
  });
});
