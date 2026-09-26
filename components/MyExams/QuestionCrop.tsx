"use client";

import { useState, type MouseEvent } from "react";
import type { QuestionRegion, SourcePage } from "../../types/questionBank";
import {
  printRegionMaxWidth,
  printRegionWidthPercent,
  regionAspectRatio,
  regionImageStyle,
  thumbnailMaxWidth,
} from "./cropStyle";

export type QuestionCropLayout =
  | { kind: "fill" }
  | { kind: "thumbnail"; maxHeightPx: number }
  | { kind: "print"; scale: number };

interface QuestionCropProps {
  regions: readonly QuestionRegion[];
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  /** 列表用 lazy；列印頁必須用 eager，否則畫面外的圖不會載入（spec §9）。 */
  loading: "lazy" | "eager";
  layout: QuestionCropLayout;
  enhance?: boolean;
  onImageLoad?: (regionIndex: number) => void;
  onImageError?: (regionIndex: number) => void;
  onRetry?: (storagePath: string) => void;
}

function regionWidth(
  layout: QuestionCropLayout,
  aspectRatio: number,
  region: QuestionRegion,
): string {
  switch (layout.kind) {
    case "fill":
      return "100%";
    case "thumbnail":
      return thumbnailMaxWidth(aspectRatio, layout.maxHeightPx);
    case "print":
      return `${printRegionWidthPercent(region.box, layout.scale)}%`;
  }
}

export function QuestionCrop({
  regions,
  pages,
  urls,
  loading,
  layout,
  enhance = false,
  onImageLoad,
  onImageError,
  onRetry,
}: QuestionCropProps) {
  const [failedPaths, setFailedPaths] = useState<ReadonlySet<string>>(() => new Set());

  const markFailed = (path: string) => {
    setFailedPaths((previous) => new Set(previous).add(path));
    // 同一頁的其他區塊也會一起換成失敗狀態（不再有 <img>），要一併回報
    regions.forEach((region, regionIndex) => {
      if (pages[region.pageIndex]?.storagePath === path) onImageError?.(regionIndex);
    });
  };

  const retry = (event: MouseEvent<HTMLButtonElement>, path: string) => {
    // 不要讓重試連帶觸發外層卡片的點擊（選取、換頁）
    event.preventDefault();
    event.stopPropagation();
    setFailedPaths((previous) => {
      const next = new Set(previous);
      next.delete(path);
      return next;
    });
    onRetry?.(path);
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {regions.map((region, regionIndex) => {
        const page = pages[region.pageIndex];
        if (!page) return null;
        const aspectRatio = regionAspectRatio(region.box, page);
        const imageStyle = regionImageStyle(region.box);
        const url = urls[page.storagePath];
        const failed = failedPaths.has(page.storagePath);

        return (
          <div
            key={regionIndex}
            data-testid="question-crop-region"
            // 列印：題目比一頁長時，讓分頁落在區塊之間，而不是切過圖中的文字
            className={`relative overflow-hidden bg-white ${layout.kind === "print" ? "break-inside-avoid" : ""}`}
            style={{
              aspectRatio,
              width: regionWidth(layout, aspectRatio, region),
              // 列印：比一頁還高的圖怎樣都會被切開，縮到剛好一頁高
              maxWidth: layout.kind === "print" ? printRegionMaxWidth(aspectRatio) : undefined,
            }}
          >
            {failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-base-200 text-xs text-base-content/70 print:bg-white print:text-black">
                <span>圖片載入失敗</span>
                {/* relative z-1：卡片可能用 ::after 撐滿點擊範圍（QuestionPicker、QuestionBankGrid），重試要疊在上面才按得到 */}
                <button
                  type="button"
                  className="btn btn-xs relative z-1 print:hidden"
                  onClick={(event) => retry(event, page.storagePath)}
                >
                  重試
                </button>
              </div>
            ) : url ? (
              <>
                <img
                  src={url}
                  alt=""
                  loading={loading}
                  decoding="async"
                  draggable={false}
                  className={`absolute max-w-none select-none ${
                    enhance ? "grayscale contrast-130 brightness-105" : ""
                  }`}
                  style={imageStyle}
                  onLoad={() => onImageLoad?.(regionIndex)}
                  onError={() => markFailed(page.storagePath)}
                />
                <svg
                  className="pointer-events-none absolute [print-color-adjust:exact]"
                  style={imageStyle}
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {page.masks.map((mask, maskIndex) => (
                    <rect
                      key={maskIndex}
                      x={mask.x}
                      y={mask.y}
                      width={mask.w}
                      height={mask.h}
                      fill="white"
                    />
                  ))}
                </svg>
              </>
            ) : (
              <div className="absolute inset-0 animate-pulse bg-base-200 print:bg-white" />
            )}
          </div>
        );
      })}
    </div>
  );
}
