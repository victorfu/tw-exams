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

## Cloudflare 受阻時的手動匯入

新增 `download --manual`（搭配 CSV 或 ID），不啟動瀏覽器，讓使用者在一般瀏覽器手動下載後提供檔案路徑。`--interactive` 的下載／驗證失敗也會進入此流程。PDF 解析成功才保存並記錄，保留原始檔案；重新執行略過已完成項目。修正原先一律建議 `login` 的錯誤提示。

已通過 22 項測試，包含 Chrome 搭配本機 HTTP 模擬網站的整合測試，以及手動匯入、HTML 拒收、中止、續抓與互動失敗後匯入的回歸測試。此功能是人工替代流程，不代表 Cloudflare 已放行自動下載；真站自動 PDF 下載仍未驗證成功。
