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

/** canvas 的像素密度：跟著螢幕，但最多 2 倍，免得高解析手機吃太多記憶體。 */
export function renderPixelRatio(devicePixelRatio: number | undefined): number {
  return Math.min(Math.max(devicePixelRatio || 1, 1), 2);
}

/** 上一級／下一級縮放，限制在 50%～300%。 */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const next = Math.round((zoom + direction * ZOOM_STEP) * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
