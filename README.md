# 自製考卷

上傳考卷或講義的照片、PDF，手動框出每一題存進題庫；已寫過的卷可以用白色遮蓋框蓋掉答案。再依科目隨機抽題組卷，印成 A4 考卷（可附答案頁）。

移植自 ollie-reader 的 `/my-exams` 功能，改成 Next.js 16（App Router）＋ Tailwind CSS v4 ＋ daisyUI 5。

## 目前限制

- **不需登入**：所有資料都掛在同一個公開使用者（`public`）底下；要等接上真正的後端，大家才會看到同一份資料。
- **上傳與儲存都是 mock**：頁面圖、題庫和考卷只存在目前這個分頁的記憶體，不跨分頁、不跨裝置，也沒有和別人共用。重新整理、用新分頁開啟「列印」「編輯」連結，或把考卷網址傳給別人，看到的都是空的題庫或「找不到這份資料」。
- **資料層在 `services/`**：元件與 hooks 只呼叫 `questionSourceService`、`bankQuestionService`、`examSheetService`，記憶體儲存集中在 `mockStore.ts`，之後接真正的後端只要換掉這三個檔案的內部實作。頁圖網址由 `getPageImageUrls(paths, force)` 提供；改用會過期的 signed URL 時，快取和到期前重簽都做在這個函式裡，`force` 為 `true` 表示圖片載入失敗、要略過快取重簽。

## 開發

```sh
npm install
npm run dev     # http://localhost:6789
npm test        # vitest（jsdom）
npm run lint
npm run build
```

## 頁面

| 路徑 | 用途 |
|---|---|
| `/my-exams` | 題庫、上傳紀錄、考卷三個分頁 |
| `/my-exams/sources/[id]` | 裁題：框題目、遮蓋、答案與作答留白（自動儲存） |
| `/my-exams/sheets/new`、`/my-exams/sheets/[id]/edit` | 組卷：隨機抽題、換題、排序、加入指定題目 |
| `/my-exams/sheets/[id]/print` | 列印版面（不含頂部列） |
| `/past-exams` | 考古題：依年級、學期、科目瀏覽，篩選後預覽 |

## 程式結構

- `app/`：路由與版面；`(app)` 群組有頂部列，`(print)` 群組是全螢幕列印頁。`globals.css` 是 daisyUI 主題（`paopaolight`／`paopaodark`）與設計 token。
- `components/MyExams/`：功能元件與純函式（框的幾何、排序、抽題、列印設定）。
- `services/`：來源、題目、考卷的資料存取（目前是記憶體 mock）。
- `hooks/`：題庫載入、自動儲存、頁圖網址。
- `utils/pageImageProcessor.ts`：照片與 PDF（pdf.js）轉成頁面 JPEG。
- `components/PastExams/`、`lib/pastExams/`：考古題頁面、pdf.js 預覽器與純函式（篩選、排序、網址狀態、檔案存取）；`app/exams/[...path]/route.ts` 提供考卷檔；`scripts/` 是產生目錄與上傳的腳本。

## 考古題

`/past-exams` 用來瀏覽 cowork 整理好的考古題。cowork 直接把資料寫進這個 repo 的 `output/`；分類、驗證、搜尋正規化都以 cowork 的 `catalog-info.json` 與 `catalog.jsonl` 為準（格式見 `output/metadata-format.md`）。這邊只讀 `output/`，不修改它。

### 資料

- `output/` 只有 meta（`*.json`、`*.jsonl`、`*.md`）進 git；PDF、Word 等考卷檔只在本機（見 `.gitignore`）。
- `npm run dev`／`npm run build` 前會自動執行 `npm run catalog`，從 `output/` 產生 `data/pastExams.json`（不進 git）。catalog 有問題（`schema_version` 不是 1、`record_count` 不符、`record_id` 重複、JSON 壞掉、`relative_path` 跳出根目錄）就失敗，dev／build 跟著停。
- 剛 clone 下來先跑一次 `npm run catalog`，型別檢查才找得到 `data/pastExams.json`。

### 考卷檔怎麼送到瀏覽器

所有考卷檔都經過本站的 `/exams/<relative_path>`：

- 只提供 catalog 裡已下載的考卷。
- 只接受本站頁面發出的請求（`Sec-Fetch-Site: same-origin`，較舊的瀏覽器看 `Referer`）；直接輸入網址、貼到聊天軟體、其他網站的連結或嵌入都會得到 403。
- 來源由 `EXAMS_FILE_SOURCE` 決定：`.env.development` 是 `local`（讀 `output/`），`.env.production` 是 `blob`（讀私有 Vercel Blob 的 `exams/<relative_path>`）。
- 預覽用 pdf.js 畫在頁面上；Word 只能下載。

### 上線（Vercel＋私有 Blob）

一次性設定：

1. 在 Vercel 建一個 **Private** 的 Blob store，連到專案的 Production、Preview、Development（使用 OIDC，不用加 read-write token）。
2. 本機執行 `npx vercel link` 與 `npx vercel env pull .env.local`（`.env.local` 不進 git；OIDC 憑證過期時重新執行 env pull）。
3. Node 版本由 `package.json` 的 `engines`（24.x）決定。在 Vercel 上 build 時，如果 `EXAMS_FILE_SOURCE` 不是 `blob` 或 store 沒有連到專案，build 會失敗。
4. Vercel 的 Build Command 要保持預設值（`npm run build`）；改成 `next build` 會跳過 `prebuild`，導致缺少 `data/pastExams.json` 而 build 失敗。

新增或更新考卷：

```sh
npm run upload:exams -- --dry-run   # 先看會上傳哪些檔案、預估用掉多少次操作
npm run upload:exams                # 只上傳新的或大小不同的檔案
git add output && git commit        # 只會加入 meta
git push                            # Vercel 自動 build
```

- 一定要先上傳再 push，否則線上會出現打不開的考卷。
- Blob 上已經不在 catalog 裡的舊檔，等新版部署上線後用 `npm run upload:exams -- --prune` 刪除。
- 想在本機測 Blob 模式：在 `.env.development.local` 寫 `EXAMS_FILE_SOURCE=blob`，重開 `npm run dev`；測完刪掉這行。

免費方案（Hobby）的限制：Blob 儲存 1 GB、每月 2,000 次進階操作（每上傳一個檔案算一次，在後台瀏覽 store 也算）、每次開考卷經過函式轉送，吃 Blob 與 Fast Origin Transfer 各 10 GB／月。超過 Blob 額度時 store 會停用最多 30 天。Hobby 只能用在非商業用途。
