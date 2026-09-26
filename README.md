# 自製考卷

上傳考卷或講義的照片、PDF，手動框出每一題存進題庫；已寫過的卷可以用白色遮蓋框蓋掉答案。再依科目隨機抽題組卷，印成 A4 考卷（可附答案頁）。

移植自 ollie-reader 的 `/my-exams` 功能，改成 Next.js 16（App Router）＋ Tailwind CSS v4 ＋ daisyUI 5。

## 目前限制

- **不需登入**，大家共用同一份資料。
- **上傳與儲存都是 mock**：頁面圖與題庫只存在瀏覽器記憶體，重新整理頁面就會清空。資料層在 `services/`（`mockStore.ts`），之後接真正的後端只要換掉這幾個檔案的內部實作。

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

- `app/`：路由與版面；`(app)` 群組有頂部列，`(print)` 群組是全螢幕列印頁。`globals.css` 是 daisyUI 主題（`ollielight`／`olliedark`）與設計 token。
- `components/MyExams/`：功能元件與純函式（框的幾何、排序、抽題、列印設定）。
- `services/`：來源、題目、考卷的資料存取（目前是記憶體 mock）。
- `hooks/`：題庫載入、自動儲存、頁圖網址。
- `utils/pageImageProcessor.ts`：照片與 PDF（pdf.js）轉成頁面 JPEG。
- `components/PastExams/`、`lib/pastExams/`：考古題頁面與純函式（篩選、排序、網址狀態）；`scripts/` 是同步腳本。

## 考古題

`/past-exams` 用來瀏覽 cowork 整理好的考古題。資料只來自 cowork `output/` 裡的 `catalog-info.json` 與 `catalog.jsonl`（格式見該目錄的 `metadata-format.md`）。分類、驗證、搜尋正規化都以 cowork 為準；這邊不讀 manifest，也不依賴目錄配置。

### 同步

```sh
npm run sync:exams -- <cowork 的 output 目錄>
```

- 沒給目錄時讀環境變數 `EXAMS_SOURCE_DIR`，可以寫在 `.env.local`（例如 `EXAMS_SOURCE_DIR=C:\Users\me\Downloads\output`）；兩個都沒有就提示用法後結束。
- 來源只讀。以下情況會中止，不覆寫既有輸出：`schema_version` 不是 1、`record_count` 與行數不符、`record_id` 重複、JSON 壞掉（會報行號）、`relative_path` 跳出根目錄、標示已下載的檔案找不到。
- 已下載的考卷照 `output/` 的相對路徑複製到 `public/exams/`（不進 git）：先刪掉不在 catalog 裡的舊檔（路徑只改大小寫也算舊檔，會重新複製），大小與修改時間都相同的檔案跳過。
- 檔案都複製完才寫 `data/pastExams.json`（進 git，每份考卷一行），所以同步中途失敗時它維持原樣。

新增科目、年級，或 cowork 改成 `layout-plan.md` 的新分層時，先在 cowork 跑 `python3 scripts/exam_catalog.py build`，再回來重跑一次同步即可。

### 上線

`public/exams` 不進 git。上線前把整個 `public/exams/` 資料夾（保持目錄結構）上傳到物件儲存（例如 R2），build 時設定：

```sh
NEXT_PUBLIC_EXAMS_BASE_URL=https://<物件儲存網址>/exams
```

檔案網址是 `${NEXT_PUBLIC_EXAMS_BASE_URL}/<relative_path>`，沒設時是 `/exams/<relative_path>`。檔案放在別的網域時，瀏覽器會忽略 `download` 屬性，Word 檔要靠物件儲存回 `Content-Disposition: attachment` 才會直接下載。
