import { vi } from "vitest";

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;
interface ObservedResize {
  callback: ResizeCallback;
  targets: Set<Element>;
}

type IntersectionCallback = (entries: { isIntersecting: boolean; target: Element }[]) => void;
interface ObservedIntersection {
  callback: IntersectionCallback;
  targets: Set<Element>;
}

const resizeObservers = new Set<ObservedResize>();
const intersectionObservers = new Set<ObservedIntersection>();

/**
 * jsdom 沒有 ResizeObserver／IntersectionObserver：換成可控制的替身。
 * IntersectionObserver 觀察時預設回報「在畫面內」，之後可用 setIntersecting 改變；
 * ResizeObserver 由 resizeObservedElements 觸發。
 * 用 vi.unstubAllGlobals() 還原。
 */
export function installObserverStubs(): void {
  resizeObservers.clear();
  intersectionObservers.clear();

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
    private readonly observed: ObservedIntersection;

    constructor(callback: IntersectionCallback) {
      this.observed = { callback, targets: new Set() };
      intersectionObservers.add(this.observed);
    }

    observe(target: Element) {
      this.observed.targets.add(target);
      this.observed.callback([{ isIntersecting: true, target }]);
    }

    unobserve(target: Element) {
      this.observed.targets.delete(target);
    }

    disconnect() {
      intersectionObservers.delete(this.observed);
    }
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

/** 模擬某個被觀察的元素的可視狀態改變（進入／離開畫面）。 */
export function setIntersecting(target: Element, isIntersecting: boolean): void {
  for (const { callback, targets } of intersectionObservers) {
    if (targets.has(target)) callback([{ isIntersecting, target }]);
  }
}
