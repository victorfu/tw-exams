import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useListScroll } from "./useListScroll";
import { listScrollPositions, resetWorkspaceState, safeReturnTo } from "./workspaceState";

let root: Root;
let container: HTMLDivElement;
let frames: FrameRequestCallback[];
function List({ href, ready = true }: { href: string; ready?: boolean }) {
  useListScroll(safeReturnTo(href), ready);
  return <div>List</div>;
}
beforeEach(() => {
  resetWorkspaceState(); frames = [];
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.push(callback); return frames.length; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it("restores canonical list positions only once data is ready, despite outgoing DOM clamping", () => {
  act(() => root.render(<List href="/my-exams?search=Math&subject=math" />));
  Object.defineProperty(window, "scrollY", { configurable: true, value: 720 });
  window.dispatchEvent(new Event("scroll"));
  // A shorter destination can clamp the viewport before unmount cleanup.
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  act(() => root.render(<div>Editor</div>));
  expect(listScrollPositions.get("/my-exams?subject=math&search=Math")).toBe(720);
  act(() => root.render(<List href="/my-exams?subject=math&search=Math" ready={false} />));
  expect(window.scrollTo).not.toHaveBeenCalled();
  act(() => root.render(<List href="/my-exams?subject=math&search=Math" />));
  act(() => frames.forEach((frame) => frame(0)));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 720, behavior: "instant" });
});
