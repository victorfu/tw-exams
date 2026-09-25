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

## 程式結構

- `app/`：路由與版面；`(app)` 群組有頂部列，`(print)` 群組是全螢幕列印頁。`globals.css` 是 daisyUI 主題（`ollielight`／`olliedark`）與設計 token。
- `components/MyExams/`：功能元件與純函式（框的幾何、排序、抽題、列印設定）。
- `services/`：來源、題目、考卷的資料存取（目前是記憶體 mock）。
- `hooks/`：題庫載入、自動儲存、頁圖網址。
- `utils/pageImageProcessor.ts`：照片與 PDF（pdf.js）轉成頁面 JPEG。
