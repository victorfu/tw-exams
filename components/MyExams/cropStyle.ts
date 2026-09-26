import type { Box, SourcePage } from "../../types/questionBank";

export interface RegionImageStyle {
  width: string;
  height: string;
  left: string;
  top: string;
}

function percent(ratio: number): string {
  // 加 0 把 -0 轉成 0，輸出 "0%" 而不是 "-0%"
  return `${ratio * 100 + 0}%`;
}

/**
 * 容器的長寬比等於框的實際長寬比，因此以容器為基準：
 * 整頁圖寬 = 1/w、高 = 1/h，再往左上平移 x/w、y/h（spec §9）。
 */
export function regionImageStyle(box: Box): RegionImageStyle {
  return {
    width: percent(1 / box.w),
    height: percent(1 / box.h),
    left: percent(-box.x / box.w),
    top: percent(-box.y / box.h),
  };
}

export function regionAspectRatio(
  box: Box,
  page: Pick<SourcePage, "width" | "height">,
): number {
  return (box.w * page.width) / (box.h * page.height);
}

/** 卡片縮圖：限制寬度，讓高度不超過 maxHeightPx。 */
export function thumbnailMaxWidth(
  aspectRatio: number,
  maxHeightPx: number,
): string {
  return `min(100%, ${Math.round(maxHeightPx * aspectRatio)}px)`;
}

/** 列印：佔內容欄寬度的百分比（0–100，spec §12.2）。 */
export function printRegionWidthPercent(box: Box, scale: number): number {
  return Math.min(box.w * scale * 100, 100);
}

/**
 * 單一區塊印出來的最大高度：A4 高 297mm − 上下邊界 12mm × 2 = 273mm，
 * 再扣掉題目 li 的 py-2 與一點餘裕。超過一頁的圖不管怎樣都會被切成兩半。
 */
export const PRINT_MAX_REGION_HEIGHT_MM = 265;

/** 列印內容欄寬：紙張 186mm − 題號欄 w-8（32px）− gap-2（8px），約 175mm。 */
export const PRINT_COLUMN_WIDTH_MM = 175;

/**
 * 列印區塊的 CSS max-width：限制寬度讓高度不超過一頁（高度 = 寬度 ÷ 寬高比）。
 * 用 mm 而不是換算成欄寬百分比，預覽變窄時也成立。
 */
export function printRegionMaxWidth(aspectRatio: number): string {
  return `${Math.round(PRINT_MAX_REGION_HEIGHT_MM * aspectRatio * 100) / 100}mm`;
}

function printedWidthMm(box: Box, aspectRatio: number, scale: number): number {
  return Math.min(
    (printRegionWidthPercent(box, scale) / 100) * PRINT_COLUMN_WIDTH_MM,
    PRINT_MAX_REGION_HEIGHT_MM * aspectRatio,
  );
}

/**
 * 從 from 倍率換成 to 倍率，是否至少有一個區塊印出來會變大。
 * 每個區塊都已經撐滿欄寬或一頁高度時，放大倍率不會有任何效果。
 */
export function printScaleEnlargesAny(
  regions: readonly { box: Box; aspectRatio: number }[],
  from: number,
  to: number,
): boolean {
  return regions.some(
    ({ box, aspectRatio }) =>
      printedWidthMm(box, aspectRatio, to) - printedWidthMm(box, aspectRatio, from) > 0.01,
  );
}
