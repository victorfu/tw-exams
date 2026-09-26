**考卷資料目錄擴充規劃**

狀態：規劃方案。現有檔案已完成英文資料夾改名，實際位置見 [README.md](README.md)；以下完整分層尚未搬遷。

建議採用「科目 → 年級 → 學期 → 出版社 → 格式」。這讓數學、英文等科目有獨立入口；新增五下、六上、六下或較低年級時，都沿用同一套規則。

```text
output/
├── README.md
├── exam-index.md
├── layout-plan.md
├── catalog.jsonl
├── catalog-info.json
├── metadata-format.md
├── math/
│   ├── grade-05/
│   │   ├── semester-1/
│   │   │   └── nani/
│   │   │       ├── README.md
│   │   │       ├── exam-index.md
│   │   │       ├── manifest.json
│   │   │       ├── pdf/
│   │   │       │   └── <original-filename>.pdf
│   │   │       └── doc/
│   │   │           └── <original-filename>.doc / .docx
│   │   └── semester-2/
│   │       └── nani/
│   └── grade-06/
│       ├── semester-1/
│       │   └── nani/
│       └── semester-2/
│           └── nani/
├── english/
├── chinese/
├── science/
└── social-studies/
```

英文、國語、自然、社會都採用與數學相同的年級、學期及出版社層級。資料實際加入時才建立對應資料夾；上方樹狀圖用於說明規則，不代表這些考卷已經存在。

**命名規則**

| 概念 | 英文名稱 | 規則 |
|---|---|---|
| 數學 | `math` | 固定科目名稱 |
| 英文 | `english` | 固定科目名稱 |
| 國語 | `chinese` | 固定科目名稱 |
| 自然 | `science` | 固定科目名稱 |
| 社會 | `social-studies` | 固定科目名稱 |
| 五年級／六年級 | `grade-05` / `grade-06` | 年級補零，後續使用 `grade-01` 至 `grade-04` |
| 上學期／下學期 | `semester-1` / `semester-2` | 不將學年度混入學期名稱 |
| 南一 | `nani` | 其他出版社另建固定英文識別名稱 |
| PDF | `pdf` | 保存原始 PDF |
| Word | `doc` | 同時容納 DOC 與 DOCX |

目錄名稱使用小寫英文字母、數字及連字號。固定中介資料檔名使用 `README.md`、`exam-index.md`、`manifest.json`。

**年度、學校與考試類型**

同一組「科目／年級／學期／出版社」集中收錄歷年考卷。學年度、學校、期中／期末及段考次序放在 manifest 和索引，不再逐層增加資料夾。

目前的 192 份可歸入同一資料集 `math/grade-05/semester-1/nani/`；索引依學年度、考試類型、學校排列，讓讀者能快速找到需要的考卷。

期中與期末使用穩定英文識別值 `midterm`、`final`。同時保留來源的 `period` 及 `period-c`，例如「期中1」「期中2」「期末2」「期末3」，避免把不同段考次序合併。學年度明確記為民國學年度，例如 `academic_year_roc: 114`。

**索引與 manifest 的責任**

- 根目錄 `exam-index.md`：列出各資料集的科目、年級、學期、出版社、年度涵蓋範圍、檔案數量及資料集索引連結。
- 各資料集 `exam-index.md`：列出每份考卷的 ID、學校、學年度、期中／期末、格式及下載連結。
- 各資料集 `manifest.json`：保存完整可機器讀取的來源資料。根目錄索引由所有資料集的 manifest 彙整產生。
- 各資料集 `README.md`：說明來源、實際涵蓋範圍、下載時間、驗證方式，以及尚未完成的項目。
- 根目錄 `catalog.jsonl`：彙整所有資料集的正規化考卷 metadata，供查詢程式或日後的搜尋服務使用。
- 根目錄 `catalog-info.json` 與 `metadata-format.md`：統計、資料品質檢查及欄位定義。

manifest 建議保留：來源系統與考卷 ID、科目、年級、學期、出版社、民國學年度、學校與縣市、考試類型及來源段考代碼、檔案角色、原始檔名、來源網址、相對路徑、格式、大小、SHA-256、取得時間及下載狀態。PDF 另記頁數。

`relative_path` 一律以 `output/` 為基準，例如：

```text
math/grade-05/semester-1/nani/pdf/20003712b51457529e8c.pdf
math/grade-05/semester-1/nani/doc/10048805e716fce70db9.docx
```

來源回傳欄位應保留；正規化欄位另記，便於回頭核對。原始文件不因整理索引而轉檔或重寫。

搜尋 metadata 已先實作於目前目錄，詳見 [metadata-format.md](metadata-format.md)。檔案搬遷後，穩定的 record_id／dataset_id 保持一致，更新 relative_path 並重建 catalog 即可。每筆 provenance 保留其原始取得時間，避免後來追加資料時覆蓋舊記錄的來源資訊。

**逐批補資料的流程**

1. 確定本批科目、年級、學期、出版社與年度範圍，取得清單及來源 ID。
2. 暫存下載於 `output/` 以外的工作目錄，檢查檔案格式、大小與雜湊。
3. 與現有 manifest 比對。相同來源 ID、檔案角色與雜湊直接略過；同名但不同內容時保留兩個版本並記錄來源，不直接覆寫。
4. 將完成的原始檔放進對應資料集的 `pdf/` 或 `doc/`，更新該資料集 manifest。
5. 重新產生該資料集索引、根目錄總索引及 catalog。更新時彙整所有既有資料集，避免新的一批覆蓋先前資料。
6. 核對缺檔、重複、連結與檔案數量；清楚保留尚未完成項目。以目錄交付，不產生 ZIP。

檔案以來源原始名稱保存；不同來源若發生同名衝突，加入來源與考卷 ID 前綴，並在 manifest 保留原名與實際儲存路徑。

**現有資料的後續搬遷對照**

| 目前位置 | 規劃位置 |
|---|---|
| `pdf/math-grade-05-semester-1-nani/*.pdf` | `math/grade-05/semester-1/nani/pdf/` |
| `doc/math-grade-05-semester-1-nani/` 中這批 20 份 Word | `math/grade-05/semester-1/nani/doc/` |
| 目前資料集的 README、索引及 manifest | `math/grade-05/semester-1/nani/` |
| 根目錄詳細考卷索引 | 改為彙整各資料集的總索引 |

完整搬遷時，以 manifest 的檔案清單作為邊界，逐份比對搬遷前後 SHA-256，更新所有相對路徑，並將本批專用的產生腳本改為依資料集設定執行。後續新增資料就不需要再改主目錄規則。
