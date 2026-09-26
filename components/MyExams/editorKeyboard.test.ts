import { describe, expect, it } from "vitest";
import type { Box } from "../../types/questionBank";
import { MIN_BOX_SIZE } from "../../constants/questionBank";
import { BOX_KEY_STEP, BOX_KEY_STEP_LARGE, isEditableTarget, keyboardBoxEdit } from "./editorKeyboard";

function expectBox(actual: Box | null, expected: Box): void {
  if (!actual) throw new Error("expected a box");
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.w).toBeCloseTo(expected.w, 10);
  expect(actual.h).toBeCloseTo(expected.h, 10);
}

describe("isEditableTarget", () => {
  it("treats form fields as editable", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
  });

  it("treats contenteditable descendants as editable", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    host.appendChild(child);
    expect(isEditableTarget(child)).toBe(true);
  });

  it("respects contenteditable=false", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "false");
    expect(isEditableTarget(host)).toBe(false);
  });

  it("ignores buttons, the body and null", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("keyboardBoxEdit", () => {
  const box: Box = { x: 0.2, y: 0.3, w: 0.4, h: 0.2 };

  it("moves the box a small step with the arrow keys", () => {
    expectBox(keyboardBoxEdit(box, { key: "ArrowRight" }), { ...box, x: 0.2 + BOX_KEY_STEP });
    expectBox(keyboardBoxEdit(box, { key: "ArrowLeft" }), { ...box, x: 0.2 - BOX_KEY_STEP });
    expectBox(keyboardBoxEdit(box, { key: "ArrowDown" }), { ...box, y: 0.3 + BOX_KEY_STEP });
    expectBox(keyboardBoxEdit(box, { key: "ArrowUp" }), { ...box, y: 0.3 - BOX_KEY_STEP });
  });

  it("moves a bigger step with Shift", () => {
    expectBox(keyboardBoxEdit(box, { key: "ArrowDown", shiftKey: true }), { ...box, y: 0.3 + BOX_KEY_STEP_LARGE });
  });

  it("keeps a moved box inside the page", () => {
    const edge: Box = { x: 0, y: 0.8, w: 0.5, h: 0.2 };
    expectBox(keyboardBoxEdit(edge, { key: "ArrowLeft", shiftKey: true }), edge);
    expectBox(keyboardBoxEdit(edge, { key: "ArrowDown" }), edge);
  });

  it("resizes from the bottom-right corner with Alt/Option", () => {
    expectBox(keyboardBoxEdit(box, { key: "ArrowRight", altKey: true }), { ...box, w: 0.4 + BOX_KEY_STEP });
    expectBox(keyboardBoxEdit(box, { key: "ArrowUp", altKey: true }), { ...box, h: 0.2 - BOX_KEY_STEP });
    expectBox(keyboardBoxEdit(box, { key: "ArrowDown", altKey: true, shiftKey: true }), {
      ...box,
      h: 0.2 + BOX_KEY_STEP_LARGE,
    });
  });

  it("does not resize past the page edge or below the minimum size", () => {
    const wide: Box = { x: 0.5, y: 0.5, w: 0.5, h: MIN_BOX_SIZE };
    expectBox(keyboardBoxEdit(wide, { key: "ArrowRight", altKey: true }), wide);
    expectBox(keyboardBoxEdit(wide, { key: "ArrowUp", altKey: true, shiftKey: true }), wide);
  });

  it("leaves other keys and browser shortcuts (Ctrl/Cmd + arrows) alone", () => {
    expect(keyboardBoxEdit(box, { key: "Enter" })).toBeNull();
    expect(keyboardBoxEdit(box, { key: "ArrowLeft", metaKey: true })).toBeNull();
    expect(keyboardBoxEdit(box, { key: "ArrowLeft", ctrlKey: true })).toBeNull();
  });
});
