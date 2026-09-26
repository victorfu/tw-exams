import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subjectColors } from "../../lib/pastExams/subjectColors";
import { SegmentButton } from "./SegmentButton";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function segmentButton(): HTMLButtonElement {
  const found = container.querySelector("button");
  if (!(found instanceof HTMLButtonElement)) throw new Error("button not found");
  return found;
}

describe("SegmentButton", () => {
  it("carries the subject tint variable for hover when unpressed", () => {
    const colors = subjectColors("chinese");
    act(() => {
      root.render(<SegmentButton label="國語" pressed={false} colors={colors} onClick={() => {}} />);
    });
    const button = segmentButton();
    expect(button.className).toContain("hover:[--btn-color:var(--seg-tint)]");
    expect(button.className).toContain("hover:[--btn-fg:var(--seg-ink)]");
    expect(button.style.getPropertyValue("--seg-tint")).toBe(colors.tint);
    expect(button.style.getPropertyValue("--seg-ink")).toBe(colors.ink);
    // pressed-only state must not leak in
    expect(button.style.getPropertyValue("--btn-color")).toBe("");
  });

  it("still carries --btn-color/--btn-fg (not the hover tint) when pressed", () => {
    const colors = subjectColors("chinese");
    act(() => {
      root.render(<SegmentButton label="國語" pressed={true} colors={colors} onClick={() => {}} />);
    });
    const button = segmentButton();
    expect(button.style.getPropertyValue("--btn-color")).toBe(colors.solid);
    expect(button.style.getPropertyValue("--btn-fg")).toBe(colors.content);
    expect(button.className).not.toContain("--seg-tint");
    expect(button.style.getPropertyValue("--seg-tint")).toBe("");
  });

  it("does not apply hover tint styling to non-subject buttons", () => {
    act(() => {
      root.render(<SegmentButton label="一" pressed={false} onClick={() => {}} />);
    });
    const button = segmentButton();
    expect(button.className).not.toContain("--seg-tint");
    expect(button.getAttribute("style")).toBeNull();
  });
});
