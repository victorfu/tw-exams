# 泡泡考卷 主題與 Logo 設計

日期：2026-09-26

## 目標

把從別的專案帶過來的 macOS「Liquid Glass」藍色主題（`ollielight` / `olliedark`）換成「泡泡考卷」自己的視覺識別，並產生 logo 與全套 favicon。

- 使用者：家長（幫小孩找考古題、印考卷）與小學生本人。調性清爽、活潑、友善，但清單與篩選仍要好讀。
- 成功標準：全站（首頁、考古題、自製考卷、組卷、裁切編輯、列印頁）亮色與暗色都套用新主題、沒有殘留的舊命名或玻璃效果；瀏覽器分頁、書籤、手機主畫面都顯示新 logo；列印仍是白底黑字。

## 1. 配色

方向：「汽水泡泡」——天空藍為主色、薄荷綠為輔色，科目各自一色。

| 角色 | 亮色 | 暗色 |
| --- | --- | --- |
| 主色 primary / accent | 天空藍 `#2F9BF0` | 提亮的天空藍 |
| 輔色 secondary | 薄荷綠 `#3DD6B5` | 提亮的薄荷綠 |
| 頁面背景 `--background` | 帶藍的白 `#F1F8FF` | 深海軍藍 |
| 卡片 `--card` / `base-100` | 白 | 比背景亮一階的藍灰 |
| 文字 `--foreground` / `base-content` | 深藍黑（`#0B3A63` 系） | 淡藍白 |
| success / warning / error | 綠 / 琥珀 / 珊瑚紅，飽和度配合主色 | 同，提亮 |

- 色值用 OKLCH 寫在 `app/globals.css`，DaisyUI 主題與自訂 token（`--accent`、`--accent-tint`、`--border-hairline`、陰影…）同步更新。
- 主題改名 `paopaolight` / `paopaodark`；`contexts/ThemeContext.tsx` 裡的 `data-theme` 值與 `THEME_INIT_SCRIPT` 同步改。localStorage key 不變，保留使用者已選的亮暗偏好。
- 暗色模式與切換按鈕保留。

## 2. 形狀、質感、字體

- 圓角：`--radius-field`（按鈕、輸入框）改為膠囊或接近膠囊，`--radius-box`（卡片、modal）約 16px，`--radius-selector` 維持膠囊。
- 質感：移除玻璃效果（`backdrop-filter`、rim 邊框、inner glow 相關 token 與 `.glass` / `.glass-panel` / `.backdrop-strong`）。`.surface-card` 改實心卡片 + 帶藍色調的柔和陰影；`.toolbar` 改實心白（暗色為卡片色）+ 底部細線。DaisyUI `exclude: glass` 的理由消失後一併移除。未使用的 class 直接刪掉。
- 字體：`next/font/google` 載入
  - 粉圓 Huninn：標題（`h1`–`h3`）、logo 字樣、首頁連結。
  - Noto Sans TC：其餘內文。
  - 以 CSS 變數（`--font-display`、`--font-body`）接到 Tailwind `@theme`，`body` 預設內文字體，標題用 `font-display`。

## 3. 每科一色

| 數學 | 國語 | 英文 | 自然 | 社會 |
| --- | --- | --- | --- | --- |
| 藍 | 珊瑚紅 | 紫 | 綠 | 琥珀 |

- 在 `lib/pastExams/labels.ts` 的 `SUBJECTS` 旁定義每科的顏色（亮／暗兩組的實色與淡色底），以 CSS 變數 `--subject-<id>` / `--subject-<id>-tint` 放在 `globals.css`，元件只引用變數名稱。
- 套用位置：
  - `CollectionPicker` 的科目選擇鈕：選中時底色為該科實色，未選中 hover 用該科淡色。
  - `PastExamsPage` 標題列的科目：顯示為該科淡色底 + 深色字的標籤。
- 未知科目（資料有但不在清單）退回主色。

## 4. Logo 與 favicon

概念：「考卷冒泡泡」——一張圓角考卷（折角、幾條題目線），右上角飄出一大一小兩顆泡泡（薄荷綠 + 天空藍）。

- `components/common/Logo.tsx`：inline SVG，完整版（有題目線），顏色用 CSS 變數以支援暗色。取代頂部列的 lucide `Printer` 圖示；首頁連結上方也放 logo + 「泡泡考卷」字樣（粉圓）。
- `app/icon.svg`：簡化版（天空藍圓角方底 + 白色考卷 + 一顆薄荷泡泡，無題目線），16px 仍可辨識。
- `app/favicon.ico`（16、32px）與 `app/apple-icon.png`（180px）：由簡化版 SVG 轉出，取代 Next 預設 favicon。轉檔腳本放 `scripts/`，產物提交進 repo。

## 5. 不做的事

- 不改版面結構或元件行為，只換視覺。
- 不做主題選擇器（只有亮／暗兩套）。
- 自製考卷列印內容不套主題色。

## 6. 驗證

- `vitest`、`tsc --noEmit`、`eslint` 全過；受影響的測試（例如檢查 `data-theme` 值或科目按鈕 class）同步更新。
- 瀏覽器逐頁檢查亮色與暗色：`/`、`/past-exams`、`/my-exams`、`/my-exams/sheets/new`、`/my-exams/sources/[id]`、列印頁。
- 列印預覽維持白底黑字。
- 分頁 favicon、apple-icon 路徑可取得（`/favicon.ico`、`/icon.svg`、`/apple-icon.png` 回 200）。
