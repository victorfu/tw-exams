# tw-exams CLI

以搜尋條件自動取得考卷資訊、翻頁、匯出 CSV／JSON，再下載 PDF。**不需要預先準備 CSV。** Python 3.10+。

## 安裝

使用 uv 管理 Python、專案虛擬環境及依賴。在專案目錄執行：

```sh
cd /Users/victor/Codebase/tw-exams
uv sync --locked
uv run playwright install chromium
uv run tw-exams --help
```

不需要手動啟用虛擬環境，`uv run` 會使用專案的 `.venv`。若已安裝 Google Chrome，可省略 Chromium 安裝，於每次指令加上 `--channel chrome`。

`.python-version` 指定開發環境使用 Python 3.12；套件仍支援 Python 3.10+。`uv.lock` 固定完整依賴解析結果，應一起納入版本控制。新增／移除依賴用 `uv add`／`uv remove`；刻意升級時執行 `uv lock --upgrade`，再執行 `uv sync --locked` 並重跑測試。

## 一個指令完成搜尋及下載

```sh
uv run tw-exams download --grade 5 --subject 數學 --semester 1 --publisher 南一
```

自動抓完符合條件的全部分頁，輸出清單，再依序下載所有題目卷。預設每次下載間隔五秒。瀏覽器為獨立工作階段，不接管 Codex 或個人日常瀏覽器。

先以一頁、一份檔案測試：

```sh
uv run tw-exams download --grade 5 --subject 數學 --semester 1 --publisher 南一 --max-pages 1 --limit 1
```

`--max-pages 1` 是刻意只取部分清單；輸出的 JSON 會標示 `complete: false`。移除此選項即抓完全部頁面。`--limit` 計算新下載檔案數；`0` 為全部，已完成的 PDF 不計入。

## 指令

### options：查看可用條件

```sh
uv run tw-exams options --grade 5
```

直接向網站查詢選項，印出 JSON 並保存 `options.json`。省略年級可查全站選項。

### search：只抓清單

```sh
uv run tw-exams search --grade 5 --subject 數學 --semester 1 --publisher 南一
```

每頁完成後更新 `exams.csv`、`exams.json`。會自動取得 exam_id、學校、縣市、年級科目、學期段考、出版社、答案類型、刷題連結、AI 家教連結、來源頁碼及是否有題目卷；JSON 另含上方「段考範圍」連結。

### download：搜尋並下載

```sh
# 題目及 PDF 答案；自動略過 AI／缺少的答案
uv run tw-exams download --grade 5 --subject 數學 --semester 1 --publisher 南一 --kind both

# 只抓官方 PDF 答案
uv run tw-exams download --grade 5 --subject 數學 --publisher 南一 --has-answer official --kind a

# 抓完整清單，列出計畫，不下載 PDF
uv run tw-exams download --grade 5 --subject 數學 --semester 1 --publisher 南一 --dry-run

# 單一考卷
uv run tw-exams download --exam-id 20002871 --kind q

# 可選：使用已匯出的 CSV，不重新搜尋
uv run tw-exams download --from-csv tcool-output/exams.csv --kind both
```

AI 答案是網站互動功能，不是 PDF，不下載。單一 ID 指定 `--kind a` 時，請自行確認有 PDF 答案；若不存在，CLI 會停止並顯示網站錯誤。

### login：建立工作階段

一般情況不需人工操作。若網站要求登入／驗證：

```sh
uv run tw-exams login
```

在開啟的瀏覽器內自行完成網站要求，回終端機按 Enter 後保存工作階段，再重跑原指令。亦可在原指令加 `--interactive`，於啟動時等待你完成操作。

下載入口可能另外出現 Cloudflare 驗證，即使首頁與 API 已正常。此時用 `--interactive` 執行下載：若第一次保存失敗，CLI 會開啟實際下載分頁，等你自行完成網站要求、看到 PDF 並按 Enter 後，再保存一次；不自動操作驗證。若仍然失敗，會提示由一般瀏覽器手動下載並輸入 PDF 路徑，或輸入 `q` 停止。

若一直卡在 Cloudflare，或工具的瀏覽器崩潰，可沿用已取得的清單，直接進入手動匯入模式：

```sh
uv run tw-exams download --from-csv tcool-output/exams.csv --manual --limit 1
```

這個模式不啟動自動化瀏覽器，也不呼叫下載 API。請在平常使用的瀏覽器自行下載提示中的考卷，再貼上完整檔案路徑（可用引號包住含空白的路徑）。請自行核對考卷 ID 與題目／答案類型；CLI 只能驗證 PDF 可讀，不能判斷內容是否對應該考卷。驗證通過後會複製到輸出目錄、留下成功紀錄並支援續抓，不會移除原檔。移除 `--limit 1` 可逐份匯入其餘考卷；這不是自動批次下載的修復。若一般瀏覽器也被網站擋住，請輸入 `q` 停止。

`login` 保存瀏覽器狀態，不保證帳號已登入或未來請求一定放行。不要同時啟動兩個使用相同 profile 的 CLI。

## 篩選與執行參數

| 參數 | 值／預設 |
|---|---|
| `--grade` | 1–12；搜尋必填 |
| `--subject` | 如 數學、國語、自然；搜尋必填 |
| `--semester` | 1 上學期、2 下學期；省略不限 |
| `--period` | 1 期中1、2 期中2、3 期末3、4 期末2；省略不限 |
| `--publisher` | 如 南一；省略不限 |
| `--city` | 如 新北市；省略不限 |
| `--has-answer` | any 不限、yes 有答案、official 官方；預設 any |
| `--kind` | q 題目、a PDF 答案、both 兩者；預設 q |
| `--max-pages` | 搜尋頁數上限；預設 0 全部 |
| `--limit` | 新下載檔數上限；預設 0 全部 |
| `--delay` | 搜尋翻頁／下載請求間隔，預設 5 秒、最少 3 秒 |
| `--output` | 預設目前目錄下的 tcool-output |
| `--profile` | 預設目前目錄下的 .tcool-browser |
| `--timeout` | 單次請求秒數，預設 60 |
| `--channel` | chromium 或 chrome |
| `--headless` | 背景執行；網站驗證可能不支援 |
| `--interactive` | 啟動及下載受阻時等待人工操作；不可搭配 headless |
| `--manual` | 搭配 --from-csv 或 --exam-id，逐份匯入手動下載的 PDF；不啟動瀏覽器 |

共用參數要放在子指令之後，例如 `uv run tw-exams search --channel chrome ...`。

## 輸出及續抓

```text
tcool-output/
  exams.csv          # UTF-8 BOM，Excel 可讀
  exams.json         # 篩選、完整性、頁數、考卷及段考範圍
  options.json       # options 指令產生
  downloads.jsonl    # 每個成功 PDF 的頁數、大小、SHA-256
  pdf/
    tcool_20002871_q.pdf
    tcool_20002871_a.pdf
```

重新執行會重新搜尋最新清單，但略過既有、可解析的 PDF。每個檔案先保存 `.part` 再改名，減少中斷造成假成功的機會；既有 PDF 損壞時會停止，請先移走該檔案再重跑。清單下載中斷時保留已取得資料，JSON 中 `complete` 為 false，不會把部分結果當成全部。

不同搜尋若要保留各自清單，請指定不同 `--output`，因為每次搜尋會更新同一輸出目錄中的 exams.csv／exams.json。CSV 是純表格，本身沒有完整性標記，請搭配 exams.json 判讀。

下載進度寫至 stderr，成功下載紀錄以 JSON Lines 印至 stdout。退出碼：0 成功、1 網站／執行錯誤、2 參數錯誤、130 使用者中止。

## 實作與限制

搜尋使用首頁的正常 POST 表單格式；下載先透過瀏覽器向 api-exam.php 取得新 download_url，再使用同源連結的 download 屬性觸發瀏覽器原生保存。即使伺服器回傳 inline PDF，也不會誤存成 PDF 檢視器 HTML。不依賴命令列直接抓取，也不重用過期 token。保存前使用 pypdf 解析頁數，不會把 HTML 阻擋頁存成 PDF。

遇到登入、安全驗證、廣告／等待要求或用量限制會停止；不自動解驗證、不修改防護、不無限重試。Cloudflare 仍可能拒絕自動化瀏覽器。工作階段存於 `.tcool-browser`，不要分享該資料夾。

網站資料可能在翻頁期間更新，跨頁去重可避免重複 ID，但無法提供伺服器未支援的資料快照保證。網站改版造成缺少關鍵欄位或分頁重複時，會報錯。

## 測試

```sh
uv run python -m unittest discover -s tests -v
# 加入真實瀏覽器、本機模擬網站的端對端測試
TCOOL_BROWSER_TESTS=1 uv run python -m unittest discover -s tests -v
# 使用已安裝 Chrome
TCOOL_BROWSER_TESTS=1 TCOOL_TEST_CHANNEL=chrome uv run python -m unittest discover -s tests -v
```

本機模擬測試涵蓋兩頁搜尋、JSON API、HTTP 重新導向、PDF 保存及再次執行略過已完成檔案。真站實測結果另見 VALIDATION.md。
