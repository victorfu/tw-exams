**搜尋 metadata 格式，schema_version = 1**

`catalog.jsonl` 每行是一份考卷的 JSON 記錄，適合未來匯入 SQLite、PostgreSQL 或其他搜尋服務。`catalog-info.json` 記錄產生時間、資料集、數量與驗證結果。來源為各資料集的 `manifest.json`，不從檔名猜測分類。

| 欄位 | 型別／例子 | 意義 |
|---|---|---|
| `record_id` | 字串，`tcool:20003712` | 跨資料集的穩定識別碼，由來源＋來源考卷 ID 組成 |
| `dataset_id` | 字串，`math-grade-05-semester-1-nani` | 科目／年級／學期／出版社的資料集 ID，與實際存放目錄分開 |
| `subject` | `math`、`english`、`chinese`、`science`、`social-studies` | 查詢用英文科目值 |
| `subject_label` | 字串，如 `數學` | API 原始科目名稱 |
| `grade` | 整數，如 `5` | 年級 |
| `semester` | 整數 `1` 或 `2` | 上／下學期 |
| `publisher` / `publisher_label` | `nani` / `南一` | 固定英文識別值及原始名稱 |
| `academic_year_roc` | 整數，如 `114` | 民國學年度，不能當成西元年 |
| `exam_type` | `midterm` 或 `final` | 期中／期末 |
| `exam_round` | 整數 | 來源段考次序，保留第 1、2、3 次的差別 |
| `period_code` / `period_label` | `4` / `期末2` | API 原始代碼及標籤 |
| `city` / `school` | 字串或 null | 縣市、學校；未知時明確保留 null |
| `title` | 字串 | 由分類欄位組成的顯示標題，不是逐字抄錄卷面標題 |
| `question_file` | 物件 | 原始檔名、相對路徑、格式、MIME、下載狀態、大小、SHA-256、頁數及來源 URL |
| `answer_available_from_source` | 布林 | API 是否提供答案檔名，不表示本機已有答案 |
| `answer_downloaded` | 布林 | 是否已登錄本機答案檔；目前全部為 false |
| `answer_source_url` | 字串或 null | 由來源答案檔名建立的網址，尚未以下載成功驗證 |
| `source` | 物件 | 來源、原始 ID、API、清單取得時間與 manifest 路徑 |
| `source_metadata` | 物件 | 保留 API 回傳的原始欄位，便於追查與修正 |
| `quality` | 物件 | metadata 依據、欄位一致性、檔案完整性、卷面分類核對狀態及缺值警示 |
| `search_text` | 字串 | metadata 關鍵字索引；使用 NFKC、大小寫正規化，統一「臺／台」，並支援「五年級／5年級／五上」等別名 |

`question_file.relative_path` 與 `source.manifest_path` 一律以 `output/` 為基準。不要依賴絕對路徑；資料夾日後搬遷只需更新 manifest 路徑並重新建索引。

每筆 manifest 記錄的 `provenance` 保存該筆來源與清單取得時間，建 catalog 時優先採用，缺少時才使用資料集的來源資訊。日後追加新資料時，保留舊記錄的 provenance，不把新批次時間套用到所有舊考卷。

目前的欄位驗證包括：年級與學期型別、科目／出版社與資料集一致、民國年度與「上／下」標籤一致、段考代碼與標籤一致、來源 ID 和路徑唯一、下載狀態與檔案存在狀態一致，以及檔案大小和 SHA-256 相符。

**正確性邊界**

分類欄位以來源 API 為依據。`quality.source_fields_consistent=true` 表示欄位彼此一致；`quality.file_integrity_verified=true` 表示檔案與已驗證 manifest 的大小、雜湊一致。兩者都不等於逐份人工核實學校或卷面年度。

目前 `quality.document_classification_reviewed=false`；尚未逐份對照 PDF／Word 卷面，也未建立題目正文搜尋。PDF 內建 Title 可能沿用舊範本，不應直接拿來覆蓋 API 分類。

答案檔來源可用性與本機下載狀態分開；未知資訊不猜填。之後若加入答案資產，需擴充資產登錄及驗證流程，才能把 `answer_downloaded` 設為 true。

**更新與查詢**

在工作區根目錄執行，僅使用 Python 標準函式庫：

```bash
python3 scripts/exam_catalog.py build
python3 scripts/exam_catalog.py search --subject math --grade 5 --semester 1 --publisher nani --year 114 --exam-type midterm
python3 scripts/exam_catalog.py search '台北 民權'
python3 scripts/exam_catalog.py search '五上 南一 期中'
python3 scripts/exam_catalog.py search --format docx
python3 scripts/exam_catalog.py search --has-answer
```

加上 `--json` 可輸出符合條件的完整 JSON 記錄。文字查詢以空白分隔，採用所有詞都符合的 metadata 搜尋；「台北 民權」與「臺北 民權」視為相同。需要查詢題目正文時，再另建文字擷取／OCR 索引，與這份分類 metadata 分開。

建置會彙整 `output/` 下所有已宣告資料集資訊的 manifest；重複 ID、重複路徑、分類矛盾、檔案遺失或雜湊不符會中止建置，不會用有問題的資料覆寫既有 catalog。目前來源轉換器支援 TCOOL，新增其他來源時需另加對應轉換規則。
