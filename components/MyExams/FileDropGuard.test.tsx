import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileDropGuard } from "./FileDropGuard";

let container: HTMLDivElement;
let root: Root;

/** jsdom 沒有 DragEvent／DataTransfer：用可取消的 Event 帶上 dataTransfer。 */
function dragEvent(type: "dragover" | "drop", types: string[]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types, files: [], dropEffect: "copy" },
  });
  return event;
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

describe("FileDropGuard", () => {
  it("keeps the browser from opening a file dropped on the page", () => {
    act(() => root.render(<FileDropGuard />));
    const target = document.createElement("p");
    document.body.appendChild(target);

    const over = dragEvent("dragover", ["Files"]);
    const drop = dragEvent("drop", ["Files"]);
    target.dispatchEvent(over);
    target.dispatchEvent(drop);

    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    target.remove();
  });

  it("leaves drags without files alone, such as dragging text between fields", () => {
    act(() => root.render(<FileDropGuard />));

    const over = dragEvent("dragover", ["text/plain"]);
    const drop = dragEvent("drop", ["text/plain"]);
    document.body.dispatchEvent(over);
    document.body.dispatchEvent(drop);

    expect(over.defaultPrevented).toBe(false);
    expect(drop.defaultPrevented).toBe(false);
  });

  it("stops guarding once it unmounts", () => {
    act(() => root.render(<FileDropGuard />));
    act(() => root.unmount());

    const drop = dragEvent("drop", ["Files"]);
    document.body.dispatchEvent(drop);

    expect(drop.defaultPrevented).toBe(false);
    root = createRoot(container);
  });
});
