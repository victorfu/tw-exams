import { describe, expect, it } from "vitest";
import { pageDisplaySize, renderPixelRatio, stepZoom, zoomLabel } from "./pdfLayout";

describe("pageDisplaySize", () => {
  it("fits the page to the container width, keeping its aspect ratio", () => {
    expect(pageDisplaySize({ width: 595, height: 842 }, 400, 1)).toEqual({ width: 400, height: 566 });
  });

  it("scales with the zoom", () => {
    expect(pageDisplaySize({ width: 595, height: 842 }, 400, 1.5)).toEqual({ width: 600, height: 849 });
  });

  it("is empty while the container has no width", () => {
    expect(pageDisplaySize({ width: 595, height: 842 }, 0, 1)).toEqual({ width: 0, height: 0 });
  });
});

describe("renderPixelRatio", () => {
  it.each([
    [3, 2],
    [1.5, 1.5],
    [undefined, 1],
    [0.5, 1],
  ])("devicePixelRatio %s → %s", (ratio, expected) => {
    expect(renderPixelRatio(ratio)).toBe(expected);
  });
});

describe("stepZoom", () => {
  it.each([
    [1, 1, 1.25],
    [1, -1, 0.75],
    [3, 1, 3],
    [0.5, -1, 0.5],
  ] as const)("%s stepped %s → %s", (zoom, direction, expected) => {
    expect(stepZoom(zoom, direction)).toBe(expected);
  });
});

describe("zoomLabel", () => {
  it("shows a percentage", () => {
    expect(zoomLabel(1.25)).toBe("125%");
  });
});
