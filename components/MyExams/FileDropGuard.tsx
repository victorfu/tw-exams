"use client";

import { useEffect } from "react";

/** 拖曳的內容有檔案才算：拖文字、連結不擋，輸入框之間照樣能拖放。 */
export function carriesFiles(event: Pick<DragEvent, "dataTransfer">): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

/**
 * 檔案拖進頁面、沒放在收檔案的地方時，瀏覽器預設會在分頁裡直接打開那個檔案，
 * 頁面一卸載，記憶體裡的來源、題目、考卷就全沒了。掛著的期間在 window 上擋掉這個預設行為；
 * 上傳對話框自己會收下拖進來的檔案。
 */
export function FileDropGuard() {
  useEffect(() => {
    const preventFileDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // 已經取消過的是上傳對話框收下的，游標照它設的顯示；其他地方顯示「不能放」，別讓人以為檔案收進去了
      if (!event.defaultPrevented && event.dataTransfer) event.dataTransfer.dropEffect = "none";
      event.preventDefault();
    };
    window.addEventListener("dragover", preventFileDrop);
    window.addEventListener("drop", preventFileDrop);
    return () => {
      window.removeEventListener("dragover", preventFileDrop);
      window.removeEventListener("drop", preventFileDrop);
    };
  }, []);

  return null;
}
