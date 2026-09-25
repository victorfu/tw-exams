# 考古題 review 頁面（/past-exams）

## Context

考卷資料在 `/Users/victor/Codebase/cowork/output/`，以「資料集」為單位：一個資料集是一組「科目×年級×學期×版本」。目前只有一個資料集（五年級數學、南一、上學期，共 192 份，全部已下載：172 份 PDF、20 份 .doc/.docx）。之後會陸續加入：
- 科目：英文、國語、自然、社會。
- 學期：五下、六上、六下。
- 年級：再回補一到四年級。

要做一個頁面方便 review 這些考卷，範圍是**瀏覽＋篩選＋預覽**。網站之後要上線。

目前的實際配置（`output/README.md`）：
- `pdf/math-grade-05-semester-1-nani/`：`manifest.json`、`README.md`、`exam-index.md`，以及 PDF 檔。
- `doc/math-grade-05-semester-1-nani/`：Word 檔。
- 根目錄：`exam-index.md`、`layout-plan.md`、`metadata-format.md`、`catalog.jsonl`、`catalog-info.json`。

`layout-plan.md` 規劃之後會改成 `math/grade-05/semester-1/nani/{manifest.json, pdf/, doc/}`，但還沒搬。

**資料來源用 `output/catalog.jsonl`**（格式見 `output/metadata-format.md`，`schema_version: 1`）。它由 cowork 的 `scripts/exam_catalog.py build` 彙整所有 manifest 產生，而且已經驗證過以下幾點：ID 與路徑不重複、欄位一致、檔案大小與 SHA-256 相符。每行一份考卷，主要欄位：
- 識別：`record_id`（例如 `tcool:20003712`）、`dataset_id`（例如 `math-grade-05-semester-1-nani`）、`title`。
- 分類：`subject`（`math`／`english`／`chinese`／`science`／`social-studies`）、`subject_label`、`grade`、`semester`、`semester_label`、`publisher`、`publisher_label`。
- 考試：`academic_year_roc`、`academic_year_label`（例如 114上）、`exam_type`（`midterm`／`final`）、`exam_type_label`、`exam_round`、`period_label`（例如 期末2）。
- 學校：`city`、`school`，未知時是 null。
- 檔案 `question_file`：`relative_path`（以 `output/` 為基準）、`format`（`pdf`／`doc`／`docx`）、`media_type`、`downloaded`、`bytes`、`page_count`。
- 答案：`answer_available_from_source`、`answer_downloaded`（目前全部是 false）。
- 搜尋與品質：`search_text`（已做 NFKC、台／臺、「五上」等別名正規化）、`quality.warnings`。

`catalog-info.json` 是彙總：`generated_at`、`record_count`、`datasets[]`（含 `id`、`subject`、`grade`、`semester`、`publisher` 與中文 label）。

設計重點：
- **只依賴 catalog，不依賴目錄配置、也不自己解析 manifest**。搬到新分層後，cowork 那邊重建 catalog、這邊重新同步即可。
- 分類、驗證、搜尋正規化都以 cowork 為準，這邊不重做。

決定：
- 原資料夾只讀，不做任何修改。
- 檔案先複製到 `public/exams`，不進 git；上線時再把同樣的目錄結構搬到物件儲存（例如 R2），只要改 base URL。
- Word 檔只提供下載。將來如果有 `downloaded: false` 的考卷，標示「尚未下載」。

## 1. 同步腳本 `scripts/sync-exams.ts`

- 執行方式：`npm run sync:exams -- <output 目錄>`，用 `node scripts/sync-exams.ts`（Node 24 可以直接跑 TS）。
- 預設讀環境變數 `EXAMS_SOURCE_DIR`，沒設就用 `/Users/victor/Codebase/cowork/output`。
- 只讀取 `catalog-info.json` 與 `catalog.jsonl`，不寫入來源。
- 以下情況報錯並中止，不覆寫既有輸出：
  - `schema_version` 不是 1。
  - `record_count` 與實際行數不符。
  - JSON 解析失敗（報出行號）。
  - `relative_path` 跳出根目錄（防呆）。
- 精簡轉換寫成純函式 `lib/pastExams/buildCatalog.ts`，讓腳本跟測試共用。
  - 輸入：catalog-info 加上 records。
  - 輸出：`{ generatedAt, datasets: [{ id, subject, subjectLabel, grade, semester, publisher, publisherLabel }], exams: [...] }`。
  - 每筆 exam：`{ id: record_id, datasetId, academicYear, academicYearLabel, examType, examTypeLabel, examRound, periodLabel, city, school, title, file: relative_path, format, pages: page_count, bytes, available: downloaded, searchText }`。
  - 丟掉 `source_metadata`、sha256、來源 URL 等前端用不到的欄位。
- 輸出：
  - `data/pastExams.json`：進 git，約 60KB／資料集。
  - `public/exams/<relative_path>`：照 `output/` 的相對路徑鏡像複製，所以之後上傳 R2 可以直接同步整個資料夾。
    - 只複製 `downloaded: true` 的考卷。
    - 目的地已有同樣大小的檔案就跳過。
    - 最後刪掉 `public/exams` 裡不在 catalog 中的舊檔（只動 `public/exams`），這樣來源改成新分層後重跑一次就會乾淨。
- `.gitignore` 加 `/public/exams/`；`package.json` 加 `"sync:exams"`。

## 2. 資料與純函式 `lib/pastExams/`

- `types.ts`：`PastExamCatalog`、`PastExamCollection`、`PastExam`。
- `catalog.ts`：從 `data/pastExams.json` 靜態 import，所以 build 時就打包進去，上線不需要讀檔系統。
- `fileUrl.ts`：`examFileUrl(file)` = `${process.env.NEXT_PUBLIC_EXAMS_BASE_URL ?? "/exams"}/${file}`，路徑逐段用 `encodeURIComponent`。
- `filters.ts`：
  - `filterExams(exams, { datasetId, academicYears, examType, city, query })`。篩選值為空代表不限。
    - `query` 用與 cowork 相同的方式正規化（NFKC、轉小寫、台→臺），以空白切詞，每個詞都要出現在 `searchText` 中。
  - `sortExams`：學年度新到舊 → 期中先於期末 → `examRound` → 縣市、學校。
  - `groupByAcademicYear`。
  - `facetValues`：由資料算出可選的學年度、縣市。
  - `labels`：例如「五年級 上學期」。科目的固定清單照 `metadata-format.md`：`math` 數學、`chinese` 國語、`english` 英文、`science` 自然、`social-studies` 社會。選擇列用這份清單顯示還沒收錄的科目；名稱優先用 dataset 的 `subjectLabel`。
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
  - 學年度 chips（可複選）、期中／期末／全部、縣市 select、搜尋框（比對 `searchText`，例如「台北 民權」）。
  - 右側顯示「共 N 份（PDF x、Word y、未下載 z）」與「清除篩選」。
- 清單 `ExamList`：
  - 依學年度分段。每列顯示學校、縣市、`periodLabel` badge、頁數、格式 badge（PDF／Word／未下載）。
  - 學校或縣市是 null 時顯示「未知」。
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
  - record 精簡成需要的欄位。
  - `schema_version` 不符時報錯。
  - `record_count` 不符時報錯。
  - 壞掉的 JSON 行報出行號。
  - `relative_path` 跳出根目錄時報錯。
  - `downloaded: false` 轉成 `available: false`。
  - `doc`／`docx` 都歸為 Word。
- `lib/pastExams/filters.test.ts`：篩選組合、搜尋正規化（「台北」能找到「臺北市」）、排序、分組、facet。
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
- 新增科目、年級，或改成 `layout-plan.md` 的新分層時，先在 cowork 跑 `python3 scripts/exam_catalog.py build`，再在這邊重新同步即可。

## 驗證

1. 跑 `npm run sync:exams`，然後確認：
   - 產生 `data/pastExams.json`：1 個 dataset（`math-grade-05-semester-1-nani`）、192 筆，全部 available，其中 PDF 172、Word 20，期中 111、期末 81。
   - `public/exams/pdf/math-grade-05-semester-1-nani/` 有 172 個 PDF，`public/exams/doc/math-grade-05-semester-1-nani/` 有 20 個 Word 檔。
   - 來源資料夾沒被改動：前後比對 `find output -type f | xargs shasum`。
   - 第二次執行會全部跳過。
   - 另外在 scratchpad 建一份小的假 catalog，`relative_path` 用 `layout-plan.md` 的新分層，再跑一次，確認舊檔會被清掉、新路徑複製正確。
2. `npm test`、`npm run lint`、`npx tsc --noEmit`、`npm run build` 全過。
3. 用 `.claude/launch.json` 的 `web` 啟動，在內建瀏覽器實際走一遍：
   - 頂部列導覽可以切換，目前頁面有標示。
   - 選擇列裡只有「五年級／上學期／數學」可選。
   - 學年度、期中期末、縣市、學校篩選都有反應，URL 也跟著變。
   - 點 PDF 在右邊預覽；← → 可以切換；Word 顯示下載。
   - 重新整理後篩選與選中的考卷都還在。
   - 手機寬度 375px 走全螢幕預覽；深色模式正常。
