import { MIN_BOX_SIZE } from "../../constants/questionBank";
import type { Box } from "../../types/questionBank";
import { moveBox } from "./boxGeometry";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * 焦點在可輸入的欄位時，頁面層級的快捷鍵不處理：裁題畫面的 Delete／Backspace／Esc
 * 才不會在答案欄刪字時把題目刪掉（spec §8.2），考古題的 ← → j k 也不會打斷搜尋輸入。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return (
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

/** 方向鍵一次移動／縮放的距離（頁面寬高的比例）；按住 Shift 用大步。 */
export const BOX_KEY_STEP = 0.005;
export const BOX_KEY_STEP_LARGE = 0.05;

const ARROW_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type BoxKey = Pick<KeyboardEventInit, "key" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey">;

/**
 * 鍵盤調整框：方向鍵移動、Alt／Option＋方向鍵從右下角縮放，Shift 加大一步。
 * 不是這些鍵（或帶 Ctrl／Cmd，那是瀏覽器與系統的快捷鍵）時回傳 null。
 * 結果一律留在頁面內；縮放不會小於 MIN_BOX_SIZE，也不會翻轉。
 */
export function keyboardBoxEdit(box: Box, event: BoxKey): Box | null {
  const delta = event.key ? ARROW_DELTAS[event.key] : undefined;
  if (!delta || event.ctrlKey || event.metaKey) return null;
  const step = event.shiftKey ? BOX_KEY_STEP_LARGE : BOX_KEY_STEP;
  const [dx, dy] = [delta[0] * step, delta[1] * step];
  if (!event.altKey) return moveBox(box, dx, dy);
  // 已經小於最小尺寸的舊框（理論上不會有）不因縮放而被撐大。
  const resize = (size: number, change: number, room: number) =>
    change === 0 ? size : Math.min(room, Math.max(Math.min(size, MIN_BOX_SIZE), size + change));
  return {
    ...box,
    w: resize(box.w, dx, 1 - box.x),
    h: resize(box.h, dy, 1 - box.y),
  };
}
