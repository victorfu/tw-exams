import { describe, expect, it } from "vitest";
import {
  PRINT_MAX_REGION_HEIGHT_MM,
  printRegionMaxWidth,
  printRegionWidthPercent,
  printScaleEnlargesAny,
  regionAspectRatio,
  regionImageStyle,
  thumbnailMaxWidth,
} from "./cropStyle";

describe("regionImageStyle", () => {
  it("scales and offsets the full page so only the box shows", () => {
    expect(regionImageStyle({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 })).toEqual({
      width: "200%",
      height: "400%",
      left: "-50%",
      top: "-200%",
    });
  });

  it("is the identity for a full-page box", () => {
    expect(regionImageStyle({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
      width: "100%",
      height: "100%",
      left: "0%",
      top: "0%",
    });
  });
});

describe("regionAspectRatio", () => {
  it("uses the box size in real pixels", () => {
    expect(
      regionAspectRatio(
        { x: 0, y: 0, w: 0.5, h: 0.25 },
        { width: 1000, height: 2000 },
      ),
    ).toBeCloseTo(1);
    expect(
      regionAspectRatio(
        { x: 0, y: 0, w: 1, h: 0.1 },
        { width: 1000, height: 1400 },
      ),
    ).toBeCloseTo(1000 / 140);
  });
});

describe("thumbnailMaxWidth", () => {
  it("caps the width so the height stays under the limit", () => {
    expect(thumbnailMaxWidth(2, 160)).toBe("min(100%, 320px)");
    expect(thumbnailMaxWidth(0.5, 160)).toBe("min(100%, 80px)");
  });
});

describe("printRegionWidthPercent", () => {
  it("keeps the original proportion of the page width", () => {
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.5, h: 0.1 }, 1)).toBeCloseTo(50);
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.5, h: 0.1 }, 0.85)).toBeCloseTo(42.5);
  });

  it("never exceeds the content column", () => {
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.95, h: 0.1 }, 1.15)).toBe(100);
  });
});

describe("printRegionMaxWidth", () => {
  it("caps the width so a tall crop never exceeds one printed page", () => {
    // 手機截圖整張（寬高比 1080/2340）：寬度上限 = 265mm × 寬高比 ≈ 122.31mm
    expect(PRINT_MAX_REGION_HEIGHT_MM).toBeLessThan(297 - 2 * 12);
    expect(printRegionMaxWidth(1080 / 2340)).toBe("122.31mm");
    expect(printRegionMaxWidth(2)).toBe("530mm");
  });
});

describe("printScaleEnlargesAny", () => {
  const wide = { box: { x: 0, y: 0, w: 1, h: 0.2 }, aspectRatio: 5 };
  const narrow = { box: { x: 0, y: 0, w: 0.5, h: 0.2 }, aspectRatio: 2.5 };
  const tall = { box: { x: 0, y: 0, w: 0.8, h: 1 }, aspectRatio: 0.4 };

  it("is false when every crop is already at the column width", () => {
    expect(printScaleEnlargesAny([wide], 1, 1.15)).toBe(false);
  });

  it("is false when every crop is already at the page height", () => {
    expect(printScaleEnlargesAny([tall], 1, 1.15)).toBe(false);
  });

  it("is true when at least one crop still grows", () => {
    expect(printScaleEnlargesAny([wide, narrow], 1, 1.15)).toBe(true);
  });
});
