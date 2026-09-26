**考卷資料目錄**

目前已收錄五年級數學、南一、上學期的期中與期末考卷，涵蓋 108–114 學年度，共 192 份：172 份 PDF、16 份 DOC、4 份 DOCX。

- [exam-index.md](exam-index.md)：目前全部考卷的索引。
- [PDF 考卷與說明](pdf/math-grade-05-semester-1-nani/README.md)。
- [Word 考卷](doc/math-grade-05-semester-1-nani/)：與 PDF 使用相同的資料集名稱。
- [layout-plan.md](layout-plan.md)：未來多科目、年級、學期的目錄規劃。
- [catalog.jsonl](catalog.jsonl)：192 筆正規化搜尋 metadata。
- [catalog-info.json](catalog-info.json)：數量、資料集與 metadata 驗證摘要。
- [metadata-format.md](metadata-format.md)：欄位定義、來源可信度及本機搜尋指令。

目錄與中介資料檔名採英文；文件內容可使用繁體中文。交付以資料夾及索引為主，不產生 ZIP。

目前的實際配置：

```text
output/
├── README.md
├── layout-plan.md
├── exam-index.md
├── catalog.jsonl
├── catalog-info.json
├── metadata-format.md
├── pdf/
│   └── math-grade-05-semester-1-nani/
│       ├── README.md
│       ├── exam-index.md
│       ├── manifest.json
│       └── <original-filename>.pdf
└── doc/
    └── math-grade-05-semester-1-nani/
        └── <original-filename>.doc / .docx
```

`layout-plan.md` 的分層是後續擴充方案，與上面這份現況分開記錄。

可先用 metadata 搜尋，例如在工作區根目錄執行：

```bash
python3 scripts/exam_catalog.py search --grade 5 --semester 1 --subject math --publisher nani --year 114 --exam-type midterm
```

更新或搬遷資料後執行 `python3 scripts/exam_catalog.py build`，由所有資料集 manifest 重建 catalog。分類依據為來源 API；目前尚未逐份人工核對卷面分類，這項狀態已記在每筆 metadata 的 `quality` 欄位。
