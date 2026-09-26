export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;

/** 每頁的顯示尺寸：寬度 = 容器寬度 × 縮放，高度依頁面原始比例。 */
export function pageDisplaySize(page: Size, containerWidth: number, zoom: number): Size {
  const width = Math.max(0, Math.floor(containerWidth * zoom));
  return { width, height: page.width > 0 ? Math.round((width * page.height) / page.width) : 0 };
}

/** iOS/iPadOS Safari 無法配置超過此像素數的 canvas（實測約 16.7M），留一點餘裕。 */
export const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * canvas 的像素密度：跟著螢幕，但最多 2 倍，免得高解析手機吃太多記憶體；
 * 有給顯示尺寸時再依 MAX_CANVAS_PIXELS 進一步限制，避免 canvas 面積超過瀏覽器上限而整頁空白。
 */
export function renderPixelRatio(devicePixelRatio: number | undefined, display?: Size): number {
  const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  if (!display || display.width <= 0 || display.height <= 0) return ratio;
  const areaCap = Math.sqrt(MAX_CANVAS_PIXELS / (display.width * display.height));
  return Math.min(ratio, areaCap);
}

/** 上一級／下一級縮放，限制在 50%～300%。 */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const next = Math.round((zoom + direction * ZOOM_STEP) * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
