import { vi } from "vitest";

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;
interface ObservedResize {
  callback: ResizeCallback;
  targets: Set<Element>;
}

const resizeObservers = new Set<ObservedResize>();

/**
 * jsdom 沒有 ResizeObserver／IntersectionObserver：換成可控制的替身。
 * IntersectionObserver 一律回報「在畫面內」；ResizeObserver 由 resizeObservedElements 觸發。
 * 用 vi.unstubAllGlobals() 還原。
 */
export function installObserverStubs(): void {
  resizeObservers.clear();

  class ResizeObserverStub {
    private readonly observed: ObservedResize;

    constructor(callback: ResizeCallback) {
      this.observed = { callback, targets: new Set() };
      resizeObservers.add(this.observed);
    }

    observe(target: Element) {
      this.observed.targets.add(target);
    }

    unobserve(target: Element) {
      this.observed.targets.delete(target);
    }

    disconnect() {
      resizeObservers.delete(this.observed);
    }
  }

  class IntersectionObserverStub {
    private readonly callback: (entries: { isIntersecting: boolean; target: Element }[]) => void;

    constructor(callback: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{ isIntersecting: true, target }]);
    }

    unobserve() {}

    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
}

/** 模擬每個被觀察的元素內容寬度變成 width。 */
export function resizeObservedElements(width: number): void {
  for (const { callback, targets } of resizeObservers) {
    if (targets.size > 0) callback([...targets].map(() => ({ contentRect: { width } })));
  }
}
