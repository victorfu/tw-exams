# 驗證紀錄（2026-09-25）

## 已通過

- 在獨立 Python 環境成功安裝套件，產生 `tcool` 指令，驗證 help 與參數檢查。
- 18 項測試全部通過，包括本機 HTTP 模擬網站搭配真實 Google Chrome 的整合測試。
- 真站自動搜尋 `grade=5, subject=數學, semester=1, publisher=南一`，未讀取使用者 CSV：20 頁，192 筆不同 exam_id，`complete=true`。
- 真站解析的答案類型：95 筆 PDF、40 筆 AI、57 筆無答案。
- 本機整合測試驗證：分頁 POST、下載 API、新網址、HTTP 302、inline PDF 原生保存、PDF 解析、再次執行略過已完成檔案。
- HTML 阻擋頁、重複分頁、頁碼錯誤、缺少 ID、損壞既有 PDF 不會被當成成功。

## 尚未通過的真站下載

- 同一獨立 Chrome 工作階段中，download_url API 已可取得新網址。
- 真站 PDF 讀取先遇到 HTTP 403；改為瀏覽器原生下載後，Playwright 回報 `canceled`。
- 進一步以同一獨立 Chrome 正常操作網站搜尋並點擊題目卷，API 回傳 200，但 /dl.php 回傳 403，下載分頁顯示 Cloudflare「Performing security verification」。因此已確認該工作階段的下載入口需要網站驗證，不是搜尋解析失敗。
- 此獨立瀏覽器工作階段尚未成功保存真站 PDF。
- 先前 Codex 內建瀏覽器能查看同一考卷的四頁 PDF，但它與 CLI 是不同工作階段，不能當成 CLI 已通過的證據。

可使用 `--interactive --channel chrome` 下載。若保存失敗，CLI 會打開實際下載入口，讓使用者自行完成驗證，看到 PDF 後再按 Enter 保存一次。此人工恢復分支尚未經真站驗證；未讓代理自動操作 Cloudflare 驗證。CLI 不會繞過驗證或無限重試。

## 範圍

自動搜尋及清單匯出已在真站完整驗證。下載實作及續抓已通過本機端對端測試，但真站 PDF 保存仍有上述環境限制。未大量下載網站考卷。

## uv 專案遷移

專案已移至 `/Users/victor/Codebase/tw-exams`，使用 `.python-version`、`uv.lock` 與 `uv sync --locked` 管理環境。遷移不改變先前記錄的真站下載限制。

遷移後已在新目錄通過 `uv sync --locked`、`uv run tcool --help`，以及使用 Chrome 的 18 項完整測試（包含本機 HTTP 端對端測試）。此次未重新測試真站下載。

## CLI 更名為 tw-exams

CLI 指令與套件名稱已改為 `tw-exams`；上方 `tcool` 指令為更名前的驗證紀錄。已通過 `uv sync --locked --offline`、新入口 `tw-exams --help` 與 17 項單元測試；1 項瀏覽器整合測試此次未啟用。README 指令已同步更新。

## 最新真站重現（exam_id 20002871）

使用專案獨立 `.tw-exams-chrome` 工作階段與正式 Chrome 重新測試：

- 首頁的搜尋表單正常出現。
- POST `/api-exam.php` 成功取得新的 `download_url`；未將 token 寫入診斷日誌。
- 同一工作階段導航至下載入口 `/dl.php`，回傳 HTTP 403、Content-Type `text/html`，並有 `cf-mitigated: challenge`。
- 分頁標題為 `Just a moment...`，使用者畫面顯示 Cloudflare 的真人驗證方框。
- 尚未觀察到進入 PDF 的重新導向，尚未保存考卷；無可回報的真站 PDF 大小及頁數。

此處停在網站驗證階段，不是 API 或 PDF 本機寫檔失敗。全自動下載仍未修復。依使用者要求，不以手動匯入取代全自動下載；已撤回本次新增的手動匯入功能。未自動解驗證、未複製個人／Codex cookies、未偽造 token。

## 互動模式：先導航，再保存

互動模式改成先導航下載入口，再處理原生下載事件或 PDF 顯示後的保存。403 驗證頁會保留在同一工作階段；按 Enter 檢查時若尚未放行則繼續等待，輸入 q 才中止。不依賴 URL 的 .pdf 副檔名判斷 PDF，亦接受 application/pdf 回應。只記錄 HTTP 狀態、PDF 類型與 challenge 標記，不記錄下載 token 或 cookies。

20 項測試通過（含真實 Chrome 搭配本機模擬 HTTP 網站），涵蓋互動模式的 302 至 inline PDF 保存、導航被下載事件中止、403 驗證頁等待後轉為 PDF，以及原有搜尋、匯出、下載及續抓。

本次真站重試 exam_id 20002871 已到達 HTTP 403、cf-mitigated: challenge 的驗證分頁。使用者回報操作後持續顯示「Verifying you are human. This may take a few seconds.」；CLI 在同一分頁觀察到後續三次導航仍為 HTTP 403、cf-mitigated: challenge，未進入 PDF。已中止此次工作階段，未保存真站 PDF；人工驗證一次後接續下載在此環境尚未成功，不能視為修復成功。

Cloudflare 官方明列 Playwright 等自動化瀏覽器不支援正式環境的驗證（https://developers.cloudflare.com/cloudflare-challenges/reference/supported-browsers/）。此限制與目前驗證循環相符，但僅憑 403 無法排除其他網站／網路因素。

## Codex Browser 單份下載驗證（2026-09-25）

本次只驗證 `exam_id=20002871`、`kind=q`。讀取既有 `exams.csv` 確認為第一頁的安和國小、新北市、五年級數學、114 上期末2、南一版；未重新爬取或改寫 192 筆清單。Codex Browser 起初沒有現有分頁，因此開啟 tcool 首頁，透過正常搜尋介面定位第一頁，再點擊該筆「題目」。

| 階段 | 本次實際觀察 |
|---|---|
| 取得新下載入口 | 點擊網站「題目」後，新分頁開啟 `/dl.php`。未提供或重用歷史 token。這證明網站操作產生下載導航；本次工具未提供該 API 的 HTTP 回應紀錄，不能宣稱另行核對過 API 回應內容。 |
| 下載入口回應 | 分頁標題為 `Just a moment...`，畫面顯示 Cloudflare `Performing security verification` 與轉圈。未取得這個 Codex Browser 分頁的原始 HTTP 狀態／headers，不能把先前 CLI 的 403 紀錄當成本次數值。 |
| 重新導向 | 尚未觀察到離開 `/dl.php` 並進入 PDF；未猜測 PDF 路徑。 |
| PDF 顯示 | 尚未顯示。 |
| 本機保存 | 尚未成功；`tcool-output/pdf/tcool_20002871_q.pdf` 不存在，無可回報的大小與 pypdf 頁數。 |
| 同工作階段第二份 | 尚未執行，須先完成第一份保存與解析驗證。 |

保留同一 Codex Browser 驗證分頁及來源清單分頁，請使用者親自處理網站出現的真人驗證；若只有轉圈而沒有方框，回報該狀態即可。未自動操作 CAPTCHA、重新整理、反覆申請連結、複製 cookies，亦未將下載／驗證 token 寫入此紀錄。下一個可驗證步驟是同分頁通過驗證並顯示 PDF 後，使用瀏覽器正常保存原始檔，再以 pypdf 驗證；本機 Python／檔案存取可用，但原始 PDF 保存尚未實測到該階段。

本次未修改搜尋、匯出或下載程式；未 commit 或 push。即使後續 Codex Browser 成功，也不代表獨立 Playwright CLI 已修復。

### 同一 Codex Browser 分頁後續已顯示 PDF

使用者回報目前能看到考卷後，代理在保留的同一分頁重新檢查，已觀察到 URL 轉為 `/v/0/…pdf`，標題為「新北市-安和國小-114-1-4-5-數學-南一-Q」。檢視器顯示 `1 / 4`，四頁縮圖與第一頁題目可見。這是 PDF 顯示成功的證據；未取得重新導向鏈的 HTTP 狀態，四頁亦尚非本機 pypdf 解析結果。

原始檔保存仍未成功，實際操作與工具限制如下：

- 點擊檢視器右上角下載圖示時，瀏覽器工具回報 `Cannot click content inside a closed shadow root`，未完成該點擊。
- 嘗試透過原生桌面介面處理該控制項，工具以安全理由禁止控制 Codex app；未繞過此限制。
- Codex Browser 的內容匯出操作回報不支援 `tab_content_export`，沒有輸出檔。
- 透過瀏覽器分頁送出 macOS 標準保存快捷鍵 `Command+S` 後，分頁仍顯示原 PDF；檢查指定保存位置及 Downloads 中最近十分鐘的 PDF／暫存下載，均未發現下載結果。

因此目前已到達「PDF 顯示」，阻擋改為「工具操作檢視器保存／取得原始下載檔」；本機 Python 與檔案存取可用，但沒有原始 PDF 可供 pypdf 驗證。沒有將檢視器 HTML、截圖或列印輸出冒充原始檔，也沒有複製 cookies、重新申請 token、猜測 PDF 路徑或測試第二份。

下一個可驗證步驟須是瀏覽器工具支援操作此 PDF 檢視器的原生下載，或提供可取得原始下載檔路徑的下載介面，然後在同工作階段保存並執行 pypdf 檢查。依使用者限制，不以使用者手動下載再匯入代替；現有分頁保留供後續接續。此結果不能視為 Codex Browser 本機下載成功，也不能視為 Playwright CLI 修復。
