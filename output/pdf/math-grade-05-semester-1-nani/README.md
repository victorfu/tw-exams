**五年級數學・南一・上學期・期中及期末考卷**

已完整下載本次 API 查詢列出的 192 份題目檔案，涵蓋 108 至 114 學年度。

格式：172 份 PDF、16 份 DOC、4 份 DOCX。保留網站提供的原始格式與檔案內容。

PDF 位於 pdf/math-grade-05-semester-1-nani/，Word 位於 doc/math-grade-05-semester-1-nani/。根目錄的「exam-index.md」可連到全部 192 份考卷。manifest.json 的 relative_path 以 output/ 為基準。

以資料夾交付，不產生 ZIP。後續擴充結構見 [layout-plan.md](../../layout-plan.md)。

期中考 111 份，期末考 81 份。所有檔案依 API 的 question 欄位取得；學校、年度、考試類型與對應檔案見「exam-index.md」。

| 學年度 | 份數 |
|---|---|
| 108 | 53 |
| 109 | 37 |
| 110 | 30 |
| 111 | 32 |
| 112 | 22 |
| 113 | 10 |
| 114 | 8 |

**取得與驗證方式**

清單使用 api-exam.php 的 action=exam_data，grade=5、subject=數學、semester=1、publisher=南一，逐頁取得並核對 192 個不重複 ID。

檔案透過正常 Chrome 瀏覽器下載流程取得。PDF 經檔頭與 pdfinfo 解析檢查；DOC 檢查 OLE 檔頭；DOCX 檢查 ZIP CRC 與 word/document.xml。每份檔案的大小、SHA-256 與 PDF 頁數保存在 manifest.json。

來源網站：https://tcool.cc/。本索引依來源 API 資料建立；來源檔案的題目內容及學校標示未改寫。

完整下載時間：2026-09-25T20:58:53.512797+08:00

索引與說明更新時間：2026-09-25T21:29:02.412792+08:00

<!-- answer-status -->
**答案卷**

既有題目中，來源提供 95 份答案，已驗證 95 份，剩餘 0 份；未提供答案者跳過。答案放在對應 PDF／Word 資料集的 `answers/` 子資料夾，配對及驗證資訊記錄於 `manifest.json` 與統一搜尋 metadata。
