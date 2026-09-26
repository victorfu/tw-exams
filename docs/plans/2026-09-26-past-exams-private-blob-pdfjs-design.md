# 考古題：output 進 repo、私有 Vercel Blob、pdf.js 預覽（設計）

## 背景

`/past-exams` 目前的做法（見 `2026-09-25-past-exams-review.md`）：

- `npm run sync:exams` 從 `EXAMS_SOURCE_DIR`（repo 外的 cowork `output/`）讀 catalog，寫出 `data/pastExams.json`（進 git），並把考卷檔複製到 `public/exams/`（不進 git）。
- 預覽用 `<iframe>` 顯示 PDF；手機改成「在新分頁開啟」。
- 上線方式還沒定。

要上線到 Vercel，而且：

1. 預覽全面改用 pdf.js，不再用 iframe。
2. 考卷檔放 Vercel Blob。
3. cowork 的 `output/` 搬進這個 repo；meta 進 git，考卷檔不進 git。
4. 不希望別的網站讀得到 PDF。

## 決定

- **cowork 直接寫進 `tw-exams/output/`**；這個 repo 只讀 `output/`、不修改它。
- **`output/` 是唯一來源**（方案 A）：目錄在 dev／build 前從 `output/` 產生，`data/pastExams.json` 不再進 git。
- **Blob store 用 Private**：已建立 `tw-exams`（`store_5BXfPSdKAif08B0e`，Private，`hkg1`，目前是空的），已連到 Vercel 專案的 Production、Preview、Development，使用 OIDC，不建長期 read-write token。本機已跑 `vercel link` 與 `vercel env pull .env.local`。
- **PDF 一律經過本站的 `/exams/...` 路由**；路由做**嚴格**來源檢查：只接受本站頁面發出的請求。
- **env 依 Next.js 規則分 development／production**。
- **Node 固定 24.x**。

## 不做

- 網站本身的登入限制（`/past-exams` 仍然公開，任何人都能從網站看考卷）。
- 阻止已經看到考卷的人存檔，或阻止偽造 header 的程式（來源檢查只擋「別的網站直接用檔案」）。
- 把 cowork 的下載與 catalog 工具搬進這個 repo。
- 目錄隨資料集增加而變大的問題（每個資料集約 130 KB 送到前端）。

## 整體流程

```
① cowork 抓好資料 → 寫進 tw-exams/output/
     meta（*.json、*.jsonl、*.md）進 git；*.pdf／*.doc／*.docx 等只在本機

② npm run dev
     predev：output/ → data/pastExams.json（不進 git）
     /past-exams → pdf.js 要 /exams/<relative_path>
       → 路由：來源檢查 → EXAMS_FILE_SOURCE=local → 讀 output/

③ npm run upload:exams
     驗證 catalog → 核對本機檔案大小 → 只傳新的或大小不同的 → private store 的 exams/<relative_path>

④ git commit（meta）→ git push → Vercel build（Node 24）
     prebuild：output/ → data/pastExams.json；catalog 壞掉 build 就失敗

⑤ 線上 /past-exams → pdf.js 要同網域 /exams/<relative_path>
     → 路由：來源檢查 → EXAMS_FILE_SOURCE=blob → get() 從 private store 讀 → 串流回瀏覽器
```

## 1. repo 結構與 git

### `output/`

- 把 `C:\Users\Victor\Downloads\output` 複製到 `tw-exams/output/`，逐檔比對 SHA-256（目前 201 個檔），全部相符後**先徵得使用者同意**，才刪除 Downloads 那份。
- 名稱維持 `output/`，與 cowork 文件（`relative_path` 以 `output/` 為基準）一致。

### `.gitignore`

```gitignore
# cowork 的考卷資料：只追蹤 meta（.json／.jsonl／.md），考卷檔不進 git
/output/**
!/output/**/
!/output/**/*.json
!/output/**/*.jsonl
!/output/**/*.md

# npm run catalog 產生
/data/pastExams.json

# env：預設值檔（.env.development、.env.production）進 git，其他不進
/.env
.env*.local
```

- 用允許清單，之後 cowork 加入答案檔、圖片、壓縮檔也會自動被忽略。
- 目前會進 git 的是 9 個檔（約 430 KB）：根目錄的 `catalog.jsonl`、`catalog-info.json`、`README.md`、`exam-index.md`、`layout-plan.md`、`metadata-format.md`，以及 `pdf/math-grade-05-semester-1-nani/` 的 `manifest.json`、`README.md`、`exam-index.md`。
- 移除 `/public/exams/` 的 ignore 規則，刪除本機的 `public/exams/`（舊同步產生的複本）。
- `git rm --cached data/pastExams.json`。

## 2. env 檔

| 檔案 | 進 git | 內容 |
|---|---|---|
| `.env.development` | 是 | `EXAMS_FILE_SOURCE=local` |
| `.env.production` | 是 | `EXAMS_FILE_SOURCE=blob` |
| `.env.local` | 否 | `vercel env pull` 產生：`BLOB_STORE_ID`、`VERCEL_OIDC_TOKEN`（短期，SDK 會用 Vercel CLI 的登入自動更新）等 |
| `.env.development.local` | 否 | 選用：`EXAMS_FILE_SOURCE=blob`，在本機測 Blob 模式 |

- `EXAMS_FILE_SOURCE` 只給伺服器用（不加 `NEXT_PUBLIC_`）。值是 `blob` 時讀 Blob，其他值（包括沒設）都讀 `output/`。
- 拿掉 `NEXT_PUBLIC_EXAMS_BASE_URL`：檔案網址永遠是 `/exams/...`。
- `.env.local` 裡的 `EXAMS_SOURCE_DIR` 刪掉。
- Vercel 上 `process.env`（專案環境變數、store 連線加的變數）優先於 `.env.production`。

## 3. 目錄產生

- `scripts/examCatalog.ts`：`generateExamCatalog({ outputDir, dataFile })`
  - 讀 `catalog-info.json` 與 `catalog.jsonl`，用現有的 `parseCatalogJsonl`、`buildCatalog` 驗證與精簡（schema_version、record_count、JSON 行號、record_id 重複、relative_path 跳出根目錄、未知 format／exam_type）。
  - **不檢查考卷檔是否存在**（Vercel 上沒有檔案）。
  - 先寫暫存檔再改名；任何錯誤都不動既有的 `dataFile`。
- `scripts/build-exam-catalog.ts`：CLI，讀 `output/`、寫 `data/pastExams.json`，印出筆數；失敗時 exit code 1。
- `package.json`
  - `"catalog": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-exam-catalog.ts"`
  - `"predev": "npm run catalog"`、`"prebuild": "npm run catalog"`
  - `"engines": { "node": "24.x" }`
  - 刪除 `sync:exams`。
- 刪除 `scripts/sync-exams.ts`、`scripts/syncExams.ts`、`scripts/syncExams.test.ts`。
- `lib/pastExams/catalog.ts` 照舊 import `data/pastExams.json`，另加 `findAvailableExamByFile(file)`（以 `file` 查已下載的考卷）。
- 剛 clone 下來要先跑一次 `npm run catalog`（或 dev／build），否則型別檢查找不到 `data/pastExams.json`；README 寫明。

## 4. `/exams` 路由

### 檔案

- `app/exams/[...path]/route.ts`：`GET(request, { params })`，`params` 是 Promise（Next 16）。
- 邏輯拆成可測試的模組：
  - `lib/pastExams/fileAccess.ts`：`isSameOriginRequest(headers, requestUrl)`。
  - `lib/pastExams/fileResponse.ts`：Content-Type、Content-Disposition、安全 header。
  - `lib/pastExams/fileSources.ts`：`local`（讀 `output/`）與 `blob`（`get()`）兩種來源，依賴可注入。
- `examFileUrl(file, { download? })`：`/exams/` + 逐段 `encodeURIComponent`；`download: true` 時加 `?download=1`。

### 處理順序

1. 路徑段接成 `relative_path`；`isSafeRelativePath` 不通過 → 404。
2. `findAvailableExamByFile` 找不到（不在 catalog 或未下載）→ 404。只提供 catalog 裡的考卷檔，meta 不會外流。
3. 來源檢查不通過 → 403，內容「請從考古題頁面開啟這份考卷。」
4. 依 `EXAMS_FILE_SOURCE` 讀檔：
   - `local`：`output/<relative_path>`，實際路徑必須在 `output/` 底下；檔案不存在 → 404。`Cache-Control: no-store`。
   - `blob`：`get("exams/" + relative_path, { access: "private", ifNoneMatch })`。沒有結果 → 404；`304` 原樣回傳（帶 ETag）；`200` 串流並帶 ETag。`Cache-Control: private, no-cache`（Vercel 建議；瀏覽器快取，但每次都會回來驗證，來源檢查每次都會執行）。不用 `s-maxage`。
5. 回應 header：
   - `Content-Type`：PDF `application/pdf`、DOC `application/msword`、DOCX `application/vnd.openxmlformats-officedocument.wordprocessingml.document`（依檔名副檔名）。
   - `Content-Disposition`：`inline`，或 `?download=1` 時 `attachment`；`filename="<原始檔名>"; filename*=UTF-8''<中文標題.副檔名 的百分比編碼>`。
   - `X-Content-Type-Options: nosniff`
   - `Cross-Origin-Resource-Policy: same-origin`
   - `Content-Security-Policy: frame-ancestors 'self'`、`X-Frame-Options: SAMEORIGIN`
   - `X-Robots-Tag: noindex, nofollow`
   - 不送任何 `Access-Control-*` header。

### 嚴格來源檢查

- `Sec-Fetch-Site` 是 `same-origin` → 通過；是 `none`、`same-site`、`cross-site` → 拒絕。
- 沒有 `Sec-Fetch-Site`（較舊的瀏覽器、非瀏覽器程式）→ `Referer` 的 origin 等於請求的 origin 才通過，否則拒絕。
- 效果：直接輸入網址、把網址貼到聊天軟體、其他網站的連結／嵌入／程式讀取都打不開；pdf.js、下載按鈕、「在新分頁開啟」都是本站發出的，可以用。
- 已知：在新分頁開啟 PDF 後按重新整理，有些瀏覽器可能被擋（驗證時實測並記錄）。

### 部署設定檢查

- `lib/pastExams/deployConfig.ts`：`checkExamsDeployConfig(env)` 回傳錯誤或警告。
- `next.config.ts` 在 production build 時呼叫：
  - 在 Vercel 上（有 `VERCEL`）：`EXAMS_FILE_SOURCE` 不是 `blob`，或沒有 `BLOB_STORE_ID` → build 失敗，訊息說明要把 store 連到專案。
  - 本機：只印警告。
- `next.config.ts` 加 `outputFileTracingExcludes`，把 `./output/**` 排除在 `/exams/[...path]` 的函式打包之外（線上用 Blob，不需要本機檔案；也避免本機 build 把考卷檔追蹤進去）。
- `@vercel/blob`（^2.8，私有儲存需要 ≥ 2.3）加入 `dependencies`（路由執行時要用）。

## 5. pdf.js 預覽器

### 單元

- `components/PastExams/pdfDocument.ts`：唯一碰 pdf.js 的模組。
  - `loadPdfDocument(url, signal)`：`fetch(url, { signal })` 下載整個檔案（考卷最大約 4 MB），非 2xx 丟出帶狀態碼的錯誤；再用 `pdfjs.getDocument({ data, ...pdfDocumentOptions })` 解析。
  - 回傳 `{ numPages, pageSize(n), renderPage(n, canvas, cssWidth, pixelRatio), destroy() }`；`renderPage` 可取消。
  - 沿用 `utils/pdfConfig.ts`（worker、CMap、標準字型從 unpkg 載入），在 effect 裡動態 import，不進第一次載入的 bundle。
- `components/PastExams/pdfLayout.ts`：純函式。
  - 每頁顯示尺寸 = 容器寬度 × 縮放，高度依原始比例。
  - canvas 像素 = 顯示尺寸 × min(devicePixelRatio, 2)。
  - 縮放：50%～300%，每級 25%；「適合寬度」= 100%。
- `components/PastExams/PdfViewer.tsx`：`{ url, title }`。
  - 可捲動容器；所有頁由上而下排列（考卷 2～4 頁），每頁先依比例佔位。
  - 頁面接近可視範圍才渲染（IntersectionObserver）；容器寬度（ResizeObserver）或縮放改變時重畫可視的頁，並取消還沒畫完的那次。
  - 右下角浮動縮放「− 100% ＋」，點百分比回到適合寬度；放大後可左右捲動。換考卷時保留縮放、捲回頂端。
  - 載入中：轉圈。錯誤：404 顯示「找不到這份考卷的檔案（可能還沒上傳）」，403 顯示「請從考古題頁面開啟這份考卷」，其他顯示「PDF 載入失敗」；都附「重試」與「在新分頁開啟」。
  - 換網址或卸載時中斷下載、釋放文件。
  - 無障礙：容器以考卷標題命名，每頁標示「第 N 頁」，縮放按鈕有文字說明。

### `ExamPreview`

- PDF 一律用 `<PdfViewer>`（桌機、手機相同）；移除 iframe、手機的「開啟 PDF」提示與 `useIsDesktop`（`viewport.ts` 的 `isDesktop` 仍給返回鍵邏輯用）。
- 上方保留：上一份、下一份、在新分頁開啟（`examFileUrl(file)`）、下載（`examFileUrl(file, { download: true })`，保留 `download` 屬性）。
- Word：說明＋下載按鈕（同上）。
- 鍵盤 ← → j k 不變；沒有 iframe 之後焦點不會被 PDF 吃掉。

## 6. 上傳到 Blob

- `scripts/uploadExams.ts`（邏輯，Blob client 可注入）＋ `scripts/upload-exams.ts`（CLI）。
- `"upload:exams": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts/upload-exams.ts"`；參數 `--dry-run`、`--prune`。
- 憑證：沿用 SDK 的順序（OIDC `VERCEL_OIDC_TOKEN`＋`BLOB_STORE_ID`，或 `BLOB_READ_WRITE_TOKEN`）。兩者都沒有 → 開始前就停下，提示執行 `npx vercel env pull .env.local`。
- 流程（全部檢查完才寫入）：
  1. 用 `parseCatalogJsonl`、`buildCatalog` 驗證 `output/` 的 catalog。
  2. 每份已下載的考卷：本機檔案必須存在，大小必須等於 catalog 的 `bytes`；任何一份不符 → 中止，一個都不傳。
  3. `list({ prefix: "exams/" })` 分頁取得遠端的 pathname 與大小（每頁一次進階操作）。
  4. 計畫：遠端沒有或大小不同 → 上傳；大小相同 → 跳過；遠端有但 catalog 沒有 → 多出來。
  5. 印出摘要與預估進階操作次數；超過 1,500 次先警告（免費方案每月 2,000 次，後台瀏覽也算）。`--dry-run` 到此結束。
  6. 上傳：同時最多 4 個；`put("exams/" + relative_path, 檔案內容, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType })`。
  7. `--prune` 才刪除「多出來」的檔案（刪除不計費）；建議等新版部署上線後再做。
  8. 結尾列出上傳／跳過／失敗／刪除數量，有失敗 exit code 1；提醒「上傳完成後再 push」。
- 第二次執行只列一次清單、全部跳過。第一次完整上傳約 193 次操作（192 份＋列清單）。

## 7. 自動測試（vitest，先寫測試並看它失敗）

- `scripts/examCatalog.test.ts`（node 環境、暫存資料夾）：不需要考卷檔就能產生；catalog 壞掉時失敗且不動既有檔案。
- `lib/pastExams/fileAccess.test.ts`：`same-origin` 通過；`none`、`same-site`、`cross-site` 拒絕；沒有 `Sec-Fetch-Site` 時 `Referer` 同源通過、不同源或沒有則拒絕。
- `lib/pastExams/fileResponse.test.ts`：三種 Content-Type；inline／attachment；中文檔名編碼；安全 header 齊全、沒有 `Access-Control-*`。
- `lib/pastExams/fileUrl.test.ts`：路徑編碼、`?download=1`。
- `lib/pastExams/deployConfig.test.ts`：Vercel 上缺 `BLOB_STORE_ID` 或模式不是 `blob` → 錯誤；本機 → 警告。
- `app/exams/[...path]/route.test.ts`（node 環境）：
  - local（暫存 `output/`）：catalog 裡的檔案 200 且 header 正確；不在 catalog、未下載、`..` → 404；跨站 → 403。
  - blob（mock `get()`）：200 串流、304 轉傳、找不到 → 404；pathname 是 `exams/<relative_path>`。
- `scripts/uploadExams.test.ts`（假 Blob client）：計畫計算；`--dry-run` 不寫入；沒有 `--prune` 不刪；本機大小不符時一個都不傳；沒有憑證的錯誤訊息；Content-Type。
- `components/PastExams/pdfLayout.test.ts`：尺寸、像素比上限、縮放上下限與級距。
- `components/PastExams/PdfViewer.test.tsx`（mock `pdfDocument`、`testing/` 補 ResizeObserver／IntersectionObserver 替身）：載入中 → N 頁；以正確寬度渲染；404／403／其他錯誤訊息、重試、「在新分頁開啟」網址；換網址時中斷並釋放上一份；按 ＋ 以更大寬度重畫並顯示 125%。
- `components/PastExams/PastExamsPage.test.tsx`：原本檢查 iframe 的測試改成檢查預覽器拿到的網址。
- 完成前：`npm test`、`npm run lint`、`npx tsc --noEmit`、`npm run build` 全過。

## 8. 手動驗證

1. 搬資料：SHA-256 全部相符；`git status` 只出現 9 個 meta；`git check-ignore` 確認 PDF／DOC 被忽略、meta 沒被忽略；徵得同意後刪除 Downloads 那份與 `public/exams/`。
2. 本機（local 模式，內建瀏覽器）：
   - 1400px 與 375px 下，真實 PDF 由 pdf.js 顯示；縮放；快速連按 ← → 顯示正確那份。
   - Word 下載檔名是中文標題；刻意指到不存在的檔案出現錯誤畫面；深色模式正常。
   - 網址列直接輸入 `/exams/...` → 403；「在新分頁開啟」可用；實測新分頁重新整理的結果。
3. 上傳：`--dry-run` 顯示 192 份、約 193 次操作 → 正式上傳 → 再跑一次全部跳過；`vercel blob get-store` 顯示 192 個檔、約 108 MB。
4. 本機 Blob 模式：`.env.development.local` 設 `EXAMS_FILE_SOURCE=blob`，重開 dev，PDF 經路由從 private store 讀到；驗證後移除該設定。
5. 線上：push 與部署要先徵得同意。部署後確認 PDF 顯示正常、跨站請求 `/exams/...` 回 403、直接輸入網址回 403。

## 9. 限制與風險

- Hobby 額度：每次開 PDF 經函式轉送，吃 Blob Data Transfer（10 GB/月）與 Fast Origin Transfer（10 GB/月），約每月 1.8 萬次「第一次打開」；同瀏覽器重看走 304。Blob 超量會停用最多 30 天。
- Blob 免費儲存 1 GB，約 9 個資料集；資料全收齊前就要升級或換儲存。
- 進階操作每月 2,000 次，一個資料集約 200 次上傳。
- pdf.js 的 worker、CMap、字型從 unpkg 載入，依賴第三方 CDN（與自製考卷相同）。
- Vercel Hobby 限定非商業使用；考卷來自第三方網站，公開網站有授權風險。
- 來源檢查無法阻止偽造 header 的程式，也無法阻止已看到考卷的人存檔。
