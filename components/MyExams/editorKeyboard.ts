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
