<p align="center">
  <img src="app/icon.svg" alt="泡泡考卷 logo" width="144" />
</p>

<h1 align="center">泡泡考卷</h1>

---

<p align="center">
  瀏覽國小考古題，或把手邊的考卷框成題庫，隨機組卷印出來。
</p>

<p align="center">
  Next.js 16 · Tailwind CSS v4 · daisyUI 5 · pdf.js
</p>

<p align="center">
  <a href="#考古題">考古題</a> ·
  <a href="#自製考卷">自製考卷</a> ·
  <a href="#給開發者">開發</a> ·
  <a href="#上線vercel私有-blob">上線</a>
</p>

泡泡考卷是給國小家長與老師用的考卷工具，分成兩個區塊：**考古題**可以依年級、學期、科目瀏覽整理好的歷屆考卷，直接在頁面上預覽 PDF；**自製考卷**可以上傳考卷或講義的照片、PDF，框出每一題存進題庫，再依科目隨機抽題，印成 A4 考卷（可附答案頁）。

## 為什麼用泡泡考卷

- 考古題集中瀏覽：依年級、學期、科目（同一科有多個出版社時再選版本）挑選資料集，再用縣市、學年度、期中／期末與關鍵字篩選
- 頁面內預覽：PDF 用 pdf.js 直接畫在頁面上，可縮放、旋轉（整份或單頁），用 `←` `→` 切換上一份／下一份；Word 檔可下載
- 解答卷：有解答的考卷在清單上標「解答」，預覽上方可切換「題目｜解答」
- 題庫自己建：照片或 PDF 上傳後手動框題，跨欄、跨頁的題目可以由多個區塊組成
- 考古題原頁框題：直接在預覽框選題目，跨考卷累積後一次組卷
- 多選交接 ChatGPT：勾選多份考卷，複製含公開檔案連結的提示詞，可選擇包含解答
- 蓋掉寫過的答案：用白色遮蓋框蓋住作答痕跡，印出來就是乾淨的題目
- 一鍵組卷：依科目設定題數隨機抽題，可換題、排序、加入指定題目
- 印得漂亮：A4 版面、三種字級、可附答案頁，長題目不會從圖片中間被切開
- 手機、平板、鍵盤都能用：觸控可以捲動與框選，也能只用鍵盤新增、移動、縮放框

## 使用方式

### 考古題

打開 `/past-exams`，先選年級、學期與科目；同一科有多個出版社（例如英語）時會多一列「版本」按鈕，附各版本份數，切換科目時預設打開份數最多的版本。再用縣市、學年度、考試別或關鍵字（例如「台北 民權」）篩選。點左邊的考卷就能預覽，`←` `→` 切換；手機上預覽會以全螢幕開啟，按返回關閉。有解答卷的考卷可以在預覽上方切到「解答」，下載與「在新分頁開啟」都跟著目前看的那一份（網址會帶 `view=answer`，換一份考卷時回到題目）。PDF 考卷可以按「框選題目」，自動準備頁圖後在原頁框題；再次開啟會重用該考卷最近更新的來源。新框的題目自動加入本次選題，既有題目可手動加入；跨卷累積後按「用這些題目組卷」。移除本次選題不會刪除題庫題目。換卷或組卷前會等待保存，失敗時留在原畫面重試。

清單左側勾選框用於交接整份考卷，與預覽、收藏及框題選取分開。切換篩選或資料集會保留勾選，「全選目前結果」只加入目前可用考卷。按「交給 ChatGPT」可編輯提問，選擇是否包含解答，再複製提示詞、開啟 ChatGPT 貼上送出。這不會自動上傳附件；若 ChatGPT 無法讀取，使用交接視窗的下載連結後手動上傳。提示詞使用 `NEXT_PUBLIC_SITE_URL`（預設正式站）產生絕對網址，本機新增但尚未部署的檔案無法供外部讀取。

**保存範圍：** 題庫、頁圖、框題、自製考卷與本次選取都只存在目前分頁記憶體；重新整理或另開分頁即清除，不會跨裝置保存。

目前收錄五年級上學期的國語（翰林）、數學（南一）、英語（康軒、翰林、何嘉仁、南一）、自然（康軒）、社會（翰林），共 852 份。考卷檔只提供給本站頁面，直接開網址或從其他網站連結都會被拒絕。

### 自製考卷

1. **上傳**：在 `/my-exams` 按「上傳題目」，選擇或直接拖進照片、PDF（一次最多 30 頁），填標題與科目。也可以在考古題的預覽按「框選題目」，標題與科目會自動帶入（Word 檔不能匯入）。
2. **框題**：在頁面上拖拉框出一題，拉四個角調整大小；切到「遮蓋」可以蓋掉答案。每題可以設定答案與作答留白，全部自動儲存。
3. **組卷**：按「組新考卷」，勾選科目與題數後隨機抽題，再換題、排序或加入指定題目。
4. **列印**：選字級、要不要附答案頁，等圖片載入完就能列印。

> **目前限制**：自製考卷還沒有接後端，不需登入，資料只存在目前這個分頁的記憶體。重新整理、用新分頁開啟「列印」「編輯」連結，或把網址傳給別人，都會看到空的題庫或「找不到這份資料」。

## 給開發者

需要 Node.js 24。

```sh
npm install
npm run catalog   # 剛 clone 下來先跑一次，產生 data/pastExams.json
npm run dev       # http://localhost:6789
npm test          # vitest（jsdom）
npm run lint
npm run build
```

- `npm run dev`／`npm run build` 前會自動執行：
  - `npm run catalog`：從 `output/` 產生 `data/pastExams.json`（不進 git）。catalog 有問題（`schema_version` 不是 1、`record_count` 不符、`record_id` 重複、JSON 壞掉、`relative_path` 跳出根目錄）就失敗，dev／build 跟著停。
  - `npm run pdfjs-assets`：把 pdf.js 的 worker、cMaps、字型、wasm 從 `node_modules/pdfjs-dist` 複製到 `public/pdfjs/<版本>/`（不進 git），PDF 上傳與考古題預覽都從同源載入。
- `npm run icons`：由 `app/icon.svg` 重新產生 favicon 與 apple icon。

### 頁面

| 路徑 | 用途 |
|---|---|
| `/` | 首頁：介紹產品，進入考古題或自製考卷（收錄數字在 build 時從目錄算出） |
| `/privacy` | 隱私權政策 |
| `/terms` | 服務條款 |
| `/past-exams` | 考古題：挑選資料集、篩選、預覽 |
| `/exams/[...path]` | 公開考卷直連（catalog 白名單） |
| `/my-exams` | 題庫、上傳紀錄、考卷三個分頁 |
| `/my-exams/sources/[id]` | 框題：框題目、遮蓋、答案與作答留白（自動儲存） |
| `/my-exams/sheets/new`、`/my-exams/sheets/[id]/edit` | 組卷：隨機抽題、換題、排序、加入指定題目 |
| `/my-exams/sheets/[id]/print` | 列印版面（不含導覽列） |

### 程式結構

- `app/`：路由與版面。`(app)` 群組有導覽（桌機是左側導覽欄、手機是頂部列），`(print)` 群組是全螢幕列印頁；`error.tsx`／`global-error.tsx` 是不重新載入整頁的錯誤畫面。`globals.css` 是 daisyUI 主題（`paopaolight`／`paopaodark`）與設計 token。
- `components/common/`：主要導覽、logo、主題切換、確認對話框。
- `components/PastExams/`、`lib/pastExams/`：考古題頁面、pdf.js 預覽器，以及篩選、排序、網址狀態、檔案存取等純函式。
- `components/Site/`、`app/(site)/`、`lib/site.ts`：首頁、隱私權政策、服務條款與共用的頂部列、頁尾；聯絡信箱與條款生效日期集中在 `lib/site.ts`。
- `components/MyExams/`：自製考卷的元件與純函式（框的幾何、排序、抽題、列印設定）。
- `services/`：來源、題目、考卷的資料存取。元件與 hooks 只呼叫 `questionSourceService`、`bankQuestionService`、`examSheetService`；記憶體儲存集中在 `mockStore.ts`，之後接後端只要換掉這三個檔案的內部實作。頁圖網址由 `getPageImageUrls(paths, force)` 提供，改用會過期的 signed URL 時，快取與重簽都做在這裡。
- `hooks/`：題庫載入、自動儲存、頁圖網址。
- `utils/`：照片與 PDF 轉成頁面 JPEG（`pageImageProcessor.ts`）、pdf.js 設定（`pdfConfig.ts`）。
- `scripts/`：產生考古題目錄、複製 pdf.js 檔案、上傳考卷、產生圖示。

### 考古題資料

cowork 直接把資料寫進這個 repo 的 `output/`；分類、驗證、搜尋正規化都以 cowork 的 `catalog-info.json` 與 `catalog.jsonl` 為準（格式見 [`output/metadata-format.md`](output/metadata-format.md)）。這邊只讀 `output/`，不修改它。

- `output/` 只有 meta（`*.json`、`*.jsonl`、`*.md`）進 git；PDF、Word 等考卷檔只在本機（見 `.gitignore`）。
- 所有考卷檔都經過本站的 `/exams/<relative_path>`：只提供 catalog 裡已下載的題目卷與解答卷（`answer_file`），允許公開直連與外部工具讀取，不要求 `Sec-Fetch-Site` 或 `Referer`。仍檢查安全路徑與 catalog 白名單，未上架及非法路徑回傳 404；保留禁止嵌入、禁止索引標頭，不開放跨站 JavaScript 的 CORS 權限。
- 來源由 `EXAMS_FILE_SOURCE` 決定：`.env.development` 是 `local`（讀 `output/`），`.env.production` 是 `blob`（讀私有 Vercel Blob 的 `exams/<relative_path>`）。

### 上線（Vercel＋私有 Blob）

一次性設定：

1. 在 Vercel 建一個 **Private** 的 Blob store，連到專案的 Production、Preview、Development（使用 OIDC，不用加 read-write token）。
2. 本機執行 `npx vercel link` 與 `npx vercel env pull .env.local`（`.env.local` 不進 git；OIDC 憑證過期時重新執行 env pull）。
3. Node 版本由 `package.json` 的 `engines`（24.x）決定。在 Vercel 上 build 時，如果 `EXAMS_FILE_SOURCE` 不是 `blob` 或 store 沒有連到專案，build 會失敗。
4. Build Command 保持預設值（`npm run build`）；改成 `next build` 會跳過 `prebuild`，缺少 `data/pastExams.json` 與 pdf.js 檔案。

新增或更新考卷：

```sh
npm run upload:exams -- --dry-run   # 先看會上傳哪些檔案、預估用掉多少次操作
npm run upload:exams                # 只上傳新的或大小不同的檔案（題目卷與解答卷）
git add output && git commit        # 只會加入 meta
git push                            # Vercel 自動 build
```

- 一定要先上傳再 push，否則線上會出現打不開的考卷。
- Blob 上已經不在 catalog 裡的舊檔，等新版部署上線後用 `npm run upload:exams -- --prune` 刪除。
- 想在本機測 Blob 模式：在 `.env.development.local` 寫 `EXAMS_FILE_SOURCE=blob`，重開 `npm run dev`；測完刪掉這行。

免費方案（Hobby）的限制：Blob 儲存 1 GB、每月 2,000 次進階操作（每上傳一個檔案算一次，在後台瀏覽 store 也算）、每次開考卷經過函式轉送，吃 Blob 與 Fast Origin Transfer 各 10 GB／月。超過 Blob 額度時 store 會停用最多 30 天。Hobby 只能用在非商業用途。

## 進一步了解

- 考古題資料格式：[output/metadata-format.md](output/metadata-format.md)
- 設計與實作計畫：[docs/plans/](docs/plans/)
