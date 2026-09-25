# 考古題 review 頁面（/past-exams）

## Context

考卷資料在 `/Users/victor/Codebase/cowork/output/`，以「資料集」為單位：一個資料集是一組「科目×年級×學期×版本」。目前只有一個資料集（五年級數學、南一、上學期，共 192 份，全部已下載：172 份 PDF、20 份 .doc/.docx）。之後會陸續加入：
- 科目：英文、國語、自然、社會。
- 學期：五下、六上、六下。
- 年級：再回補一到四年級。

要做一個頁面方便 review 這些考卷，範圍是**瀏覽＋篩選＋預覽**。網站之後要上線。

目前的實際配置（`output/README.md`）：
- `pdf/math-grade-05-semester-1-nani/`：`manifest.json`、`README.md`、`exam-index.md`，以及 PDF 檔。
- `doc/`：Word 檔。
- `exam-index.md`、`layout-plan.md`：放在根目錄。

`layout-plan.md` 規劃之後會改成 `math/grade-05/semester-1/nani/{manifest.json, pdf/, doc/}`，但還沒搬。

`manifest.json`（`schema_version: 1`）的內容：
- `dataset`：包含 `id`、`subject`（例如 math）、`subject_label`（例如 數學）、`grade`（數字）、`semester`（1/2）、`publisher`（例如 nani）、`publisher_label`（例如 南一）。
- `exams[]`：原始 API 欄位（`id`、`school`、`city`、`year-c`、`year`、`period-c`、`period`、`question`、`downloaded`、`pages` 等），以及 `relative_path`。`relative_path` 以 `output/` 為基準，例如 `pdf/math-grade-05-semester-1-nani/xxx.pdf`、`doc/xxx.docx`。

設計重點：**不依賴目錄配置**。一律以 manifest 的 `dataset` 與 `relative_path` 為準，這樣搬到新的分層之後，頁面與腳本都不必修改。

決定：
- 原資料夾只讀，不做任何修改。
- 檔案先複製到 `public/exams`，不進 git；上線時再把同樣的目錄結構搬到物件儲存（例如 R2），只要改 base URL。
- Word 檔只提供下載。將來如果有 `downloaded: false` 的考卷，標示「尚未下載」。

## 1. 同步腳本 `scripts/sync-exams.ts`

- 執行方式：`npm run sync:exams -- <來源根目錄>`，用 `node scripts/sync-exams.ts`（Node 24 可以直接跑 TS）。
- 預設讀環境變數 `EXAMS_SOURCE_DIR`，沒設就用 `/Users/victor/Codebase/cowork/output`。這是 `relative_path` 的基準目錄。
- 用遞迴找出根目錄下所有 `manifest.json`，任何深度都可以，這樣新舊兩種配置都能用。只讀不寫。
- 分組直接用 manifest 的 `dataset`：`id` 當 collection key，另外帶 `subject`／`subject_label`、`grade`、`semester`、`publisher`／`publisher_label`。
  - `schema_version` 不是 1 時報錯。
  - 兩個 manifest 的 `dataset.id` 重複時報錯。
  - 缺必要欄位時，報錯並指出是哪個檔案。
- 每份考卷的檔案位置是 `path.join(根目錄, relative_path)`。
  - 路徑跳出根目錄時報錯（防呆）。
  - 沒有 `relative_path` 的舊 manifest，退回用 manifest 所在資料夾加 `question`。
- 輸出：
  - `data/pastExams.json`：進 git，約 50KB／資料集。內容是 `{ generatedAt, collections: [{ key, subject, subjectLabel, grade, semester, publisher, publisherLabel, exams: [{ id, schoolYear, examType, examLabel, school, city, file, format, pages, bytes, available }] }] }`。
    - `examType` 由 `period-c` 開頭判斷：期中為 `midterm`，期末為 `final`。`examLabel` 保留原本的 `period-c`。
    - `file` 就是 `relative_path`。
    - `format` 由副檔名判斷，分成 `pdf` 或 `word`。
    - `available` 必須 `downloaded` 為真而且檔案確實存在。
  - `public/exams/<relative_path>`：照 `output/` 的相對路徑鏡像複製，所以之後上傳 R2 可以直接同步整個資料夾。
    - 目的地已有同樣大小的檔案就跳過。
    - 最後刪掉 `public/exams` 裡不在目錄中的舊檔（只動 `public/exams`），這樣來源改成新分層後重跑一次就會乾淨。
- 轉換邏輯（manifest → collection）寫成純函式放在 `lib/pastExams/buildCatalog.ts`，讓腳本跟測試共用。
- `.gitignore` 加 `/public/exams/`；`package.json` 加 `"sync:exams"`。

## 2. 資料與純函式 `lib/pastExams/`

- `types.ts`：`PastExamCatalog`、`PastExamCollection`、`PastExam`。
- `catalog.ts`：從 `data/pastExams.json` 靜態 import，所以 build 時就打包進去，上線不需要讀檔系統。
- `fileUrl.ts`：`examFileUrl(file)` = `${process.env.NEXT_PUBLIC_EXAMS_BASE_URL ?? "/exams"}/${file}`，路徑逐段用 `encodeURIComponent`。
- `filters.ts`：
  - `filterExams(exams, { schoolYears, examType, city, query })`。`query` 比對學校與縣市；篩選值為空代表不限。
  - `sortExams`：學年度新到舊 → 期中先於期末 → 期別 → 縣市、學校。
  - `groupBySchoolYear`。
  - `facetValues`：由資料算出可選的學年度、縣市。
  - `labels`：例如「五年級 上學期」。科目的固定清單照 `layout-plan.md`：`math` 數學、`chinese` 國語、`english` 英文、`science` 自然、`social-studies` 社會。選擇列用這份清單顯示還沒收錄的科目；名稱優先用 manifest 的 `subject_label`。
- 篩選狀態放在 URL searchParams（`c`、`year`、`type`、`city`、`q`、`id`），可以分享連結，重新整理也不會掉。

## 3. 頁面 `/past-exams`

- 路由檔：`app/(app)/past-exams/page.tsx`，是 server component，包 `<Suspense>` 渲染 client 元件 `components/PastExams/PastExamsPage.tsx`。
- 頂部列 `app/(app)/layout.tsx`：在標題右邊加兩個導覽連結「自製考卷」與「考古題」。目前的連結用 `usePathname` 標示。這部分抽成一個小的 client 元件 `components/common/TopNav.tsx`。
- 版面：
  - 由上而下：選擇列 → 篩選列 → 主要區域。
  - 桌機主要區域左右分割：左邊清單，右邊預覽。
  - 手機（< md）只顯示清單。點一份會開全螢幕預覽層，裡面有上一份／下一份與關閉。
- 選擇列 `CollectionPicker`：
  - 年級 1–6、學期上／下、科目五科，都是 daisyUI join／btn 分段按鈕。
  - 沒有資料的組合按鈕是 disabled，並顯示「尚未收錄」。
  - 同一組合有多個版本時才顯示版本選單。
  - 預設選目錄裡第一個有資料的組合。
- 篩選列 `ExamFilters`：
  - 學年度 chips（可複選）、期中／期末／全部、縣市 select、學校搜尋框。
  - 右側顯示「共 N 份（PDF x、Word y、未下載 z）」與「清除篩選」。
- 清單 `ExamList`：
  - 依學年度分段。每列顯示學校、縣市、考試別 badge、頁數、格式 badge（PDF／Word／未下載）。
  - 目前選中的那列高亮，並 `scrollIntoView`。
  - 未下載的列不能點，文字變淡。
- 預覽 `ExamPreview`：
  - 標題列：學校、學年度與考試別、頁數，按鈕有「上一份／下一份」「在新分頁開啟」「下載」。
  - PDF：用 `<iframe src={url}#view=FitH>` 交給瀏覽器內建 PDF 檢視器，不另外載入 pdf.js。
  - Word：顯示說明「Word 檔無法在頁面內預覽」，附下載按鈕。
  - 沒選任何一份時：顯示提示「點左邊的考卷開始瀏覽，可用 ← → 切換」。
- 鍵盤：焦點不在輸入框時，`←`/`→`（以及 `j`/`k`）在篩選後的清單中移到上一份／下一份，會略過未下載的。
- 樣式：沿用現有 token（`surface-card`、`border-border-hairline`、`bg-background`…）。深色模式、375px 手機寬度都不能有橫向捲動。
- `app/page.tsx` 仍然導到 `/my-exams`。

## 4. 測試（vitest）

- `lib/pastExams/buildCatalog.test.ts`：
  - `dataset` 對應成 collection。
  - `schema_version` 不符、缺欄位時報錯。
  - `dataset.id` 重複時報錯。
  - `relative_path` 跳出根目錄時報錯。
  - 沒有 `relative_path` 時退回用 `question`。
  - `period-c` 轉成期中／期末。
  - 未下載轉成 `available: false`。
  - 副檔名轉成 `format`。
- `lib/pastExams/filters.test.ts`：篩選組合、排序、分組、facet。
- `components/PastExams/PastExamsPage.test.tsx`（沿用 `testing/nextNavigation.ts`）：
  - 篩選會改 URL。
  - 點列會設 `id` 並顯示 iframe。
  - Word 顯示下載。
  - ← → 會略過未下載的。
  - 沒有資料的組合是 disabled。

## 5. 文件

`README.md` 加一節「考古題」，說明以下幾點：
- 同步指令。
- `EXAMS_SOURCE_DIR` 與 `NEXT_PUBLIC_EXAMS_BASE_URL`。
- `public/exams` 不進 git，上線前要先把檔案搬到物件儲存並設定 base URL。
- 新增科目、年級，或改成 `layout-plan.md` 的新分層時，只要 manifest 帶 `dataset` 與 `relative_path`，重新同步一次即可。

## 驗證

1. 跑 `npm run sync:exams`，然後確認：
   - 產生 `data/pastExams.json`：1 個 collection（`math-grade-05-semester-1-nani`）、192 筆，全部 available，其中 PDF 172、Word 20。
   - `public/exams/pdf/math-grade-05-semester-1-nani/` 有 172 個 PDF，`public/exams/doc/` 有 20 個 Word 檔。
   - 來源資料夾沒被改動：前後比對 `find output -type f | xargs shasum`。
   - 第二次執行會全部跳過。
   - 另外在 scratchpad 建一份照 `layout-plan.md` 新分層的假資料再跑一次，確認新配置也讀得到。
2. `npm test`、`npm run lint`、`npx tsc --noEmit`、`npm run build` 全過。
3. 用 `.claude/launch.json` 的 `web` 啟動，在內建瀏覽器實際走一遍：
   - 頂部列導覽可以切換，目前頁面有標示。
   - 選擇列裡只有「五年級／上學期／數學」可選。
   - 學年度、期中期末、縣市、學校篩選都有反應，URL 也跟著變。
   - 點 PDF 在右邊預覽；← → 可以切換；Word 顯示下載。
   - 重新整理後篩選與選中的考卷都還在。
   - 手機寬度 375px 走全螢幕預覽；深色模式正常。
