# 泡泡考卷 主題與 Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `ollie*` Liquid Glass 主題換成「泡泡考卷」汽水藍主題（含每科一色、粉圓標題字、logo 與全套 favicon）。

**Architecture:** 所有色彩集中在 `app/globals.css`（DaisyUI 兩個主題 + 自訂 token + 科目 CSS 變數），元件只引用 token。科目顏色由 `lib/pastExams/subjectColors.ts` 把科目 id 轉成 CSS 變數參照，`SegmentButton` 以 DaisyUI 5 的 `--btn-color` / `--btn-fg` 套色。Logo 是 inline SVG 元件；favicon 由腳本從 `app/icon.svg` 用 sharp 轉出。

**Tech Stack:** Next.js 16.3（App Router、`next/font/google`、metadata file conventions）、Tailwind v4、DaisyUI 5、Vitest + jsdom、sharp。

**Spec:** `docs/plans/2026-09-26-paopao-theme-design.md`

## Global Constraints

- 主題名稱：`paopaolight`（default）/ `paopaodark`（prefersdark）；localStorage key `ollie-theme` 不變。
- 品牌色：天空藍 `#2F9BF0`、薄荷綠 `#3DD6B5`（logo 與 favicon 用這兩個 hex）；互動用主色為較深的 `oklch(0.56 0.16 252)` 以確保白字對比 ≥ 4.5。
- 科目順序與顏色：數學 藍、國語 珊瑚紅、英文 紫、自然 綠、社會 琥珀；未知科目退回主色。
- 字體：標題 Huninn（僅 400）、內文 Noto Sans TC；兩者 `preload: false`（沒有中文 subset）。
- 不改版面結構與元件行為；列印頁維持白底黑字。
- 註解語言跟隨周圍程式碼（元件內中文註解）。

## Review Focus

1. 暗色模式下的科目按鈕與科目標籤：文字要讀得到（Task 1 的 CSS 變數有暗色版；Task 6 瀏覽器檢查）。
2. 資料裡出現不在 `SUBJECTS` 的科目 id：按鈕與標籤退回主色，不是透明或無色（Task 1 測試）。
3. Huninn 只有 400：`font-semibold` 的標題不能出現假粗體（Task 2 `font-synthesis: none`；Task 6 檢查）。
4. 列印頁：主題背景、陰影不能印出來（Task 6 列印預覽）。
5. 首次載入沒有 localStorage：`THEME_INIT_SCRIPT` 設定的 `data-theme` 必須是新名稱，否則 DaisyUI 元件會無色（Task 2 測試）。

---

### Task 1: 科目顏色 helper

**Files:**
- Create: `lib/pastExams/subjectColors.ts`
- Test: `lib/pastExams/subjectColors.test.ts`

**Interfaces:**
- Produces: `subjectColors(subject: string): { solid: string; content: string; tint: string; ink: string }`，每個值是 `var(--subject-<id>…)` 或主色 fallback 的 CSS 字串。對應的 CSS 變數在 Task 2 定義。

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, expect, it } from "vitest";
import { subjectColors } from "./subjectColors";
import { SUBJECTS } from "./labels";

describe("subjectColors", () => {
  it("maps every known subject to its CSS variables", () => {
    for (const { id } of SUBJECTS) {
      expect(subjectColors(id)).toEqual({
        solid: `var(--subject-${id})`,
        content: `var(--subject-${id}-content)`,
        tint: `var(--subject-${id}-tint)`,
        ink: `var(--subject-${id}-ink)`,
      });
    }
  });

  it("falls back to the primary colour for unknown subjects", () => {
    expect(subjectColors("music")).toEqual({
      solid: "var(--color-primary)",
      content: "var(--color-primary-content)",
      tint: "var(--accent-tint)",
      ink: "var(--color-primary)",
    });
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/pastExams/subjectColors.test.ts` → FAIL（module not found）
- [ ] **Step 3: 實作**

```ts
import { SUBJECTS } from "./labels";

export interface SubjectColors {
  solid: string;
  content: string;
  tint: string;
  ink: string;
}

const FALLBACK: SubjectColors = {
  solid: "var(--color-primary)",
  content: "var(--color-primary-content)",
  tint: "var(--accent-tint)",
  ink: "var(--color-primary)",
};

/** 每科一色：實色（選中按鈕）、其上文字、淡色底（標籤）、淡色底上的文字。色值在 globals.css。 */
export function subjectColors(subject: string): SubjectColors {
  if (!SUBJECTS.some((item) => item.id === subject)) return FALLBACK;
  const name = `--subject-${subject}`;
  return { solid: `var(${name})`, content: `var(${name}-content)`, tint: `var(${name}-tint)`, ink: `var(${name}-ink)` };
}
```

- [ ] **Step 4:** 同一指令 → PASS
- [ ] **Step 5:** commit `feat(theme): subject colour helper`

### Task 2: 主題 token、字體、移除玻璃效果

**Files:**
- Modify: `app/globals.css`（整段重寫主題、token、components layer）
- Modify: `contexts/ThemeContext.tsx:66-85`、`app/layout.tsx`
- Test: `contexts/ThemeContext.test.ts`（新）

**Interfaces:**
- Produces: CSS 變數 `--subject-{math,chinese,english,science,social-studies}{,-content,-tint,-ink}`；Tailwind `font-display`；`.surface-card`、`.toolbar` 保留名稱（實心樣式）。

- [ ] **Step 1: 寫失敗測試**（`THEME_INIT_SCRIPT` 在沒有儲存值、系統亮色時設 `paopaolight`；暗色時 `paopaodark`）

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT } from "./ThemeContext";

function runInit(systemDark: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: systemDark }));
  localStorage.clear();
  new Function(THEME_INIT_SCRIPT)();
  return document.documentElement.getAttribute("data-theme");
}

afterEach(() => vi.unstubAllGlobals());

describe("THEME_INIT_SCRIPT", () => {
  it("uses the paopao themes", () => {
    expect(runInit(false)).toBe("paopaolight");
    expect(runInit(true)).toBe("paopaodark");
  });
});
```

（測試檔頂端加 `// @vitest-environment jsdom`，如果 vitest 設定不是預設 jsdom。）

- [ ] **Step 2:** `npx vitest run contexts` → FAIL（得到 `ollielight`）
- [ ] **Step 3:** `ThemeContext.tsx` 的兩處 `"olliedark" : "ollielight"` 改為 `"paopaodark" : "paopaolight"`；`app/layout.tsx` 的 `data-theme="ollielight"` 改 `paopaolight`。
- [ ] **Step 4:** 重寫 `app/globals.css` 主題段落：

  - `@plugin "daisyui"` 移除 `exclude: glass` 與其註解（改為 `@plugin "daisyui";`）。
  - 兩個 `@plugin "daisyui/theme"`：

  | token | paopaolight | paopaodark |
  | --- | --- | --- |
  | base-100 / 200 / 300 | `oklch(1 0 0)` / `oklch(0.965 0.014 245)` / `oklch(0.925 0.022 245)` | `oklch(0.24 0.035 255)` / `oklch(0.21 0.03 255)` / `oklch(0.3 0.04 255)` |
  | base-content | `oklch(0.3 0.07 252)` | `oklch(0.95 0.015 245)` |
  | primary / -content | `oklch(0.56 0.16 252)` / `oklch(1 0 0)` | `oklch(0.7 0.14 248)` / `oklch(0.18 0.04 255)` |
  | secondary / -content | `oklch(0.72 0.13 172)` / `oklch(0.25 0.06 175)` | `oklch(0.78 0.12 172)` / `oklch(0.18 0.04 255)` |
  | accent, info | 同 primary | 同 primary |
  | neutral / -content | `oklch(0.35 0.06 252)` / `oklch(0.98 0.01 245)` | `oklch(0.35 0.05 255)` / `oklch(0.95 0.015 245)` |
  | success / -content | `oklch(0.62 0.15 155)` / `oklch(1 0 0)` | `oklch(0.72 0.15 155)` / `oklch(0.18 0.04 255)` |
  | warning / -content | `oklch(0.7 0.15 70)` / `oklch(0.28 0.07 55)` | `oklch(0.8 0.14 75)` / `oklch(0.2 0.05 70)` |
  | error / -content | `oklch(0.6 0.19 25)` / `oklch(1 0 0)` | `oklch(0.68 0.18 25)` / `oklch(0.18 0.04 255)` |
  | radius selector / field / box | `1rem` / `1rem` / `1rem` | 同 |

  其他（size、border、depth 0、noise 0）照舊。

  - `:root` / `.dark, [data-theme="paopaodark"]` token：
    - `--background`：`oklch(0.977 0.012 245)`（≈`#F1F8FF`）/ `oklch(0.19 0.03 255)`
    - `--foreground`：同 base-content
    - `--card`：`oklch(1 0 0)` / `oklch(0.24 0.035 255)`（不透明）
    - `--muted-foreground`：`oklch(0.48 0.05 250)` / `oklch(0.72 0.03 245)`
    - `--accent` / `--accent-tint`：主色 / 主色 `/ 0.1`（暗色 `/ 0.16`）
    - `--border-hairline`：`oklch(0.45 0.08 250 / 0.12)` / `oklch(1 0 0 / 0.08)`
    - `--destructive` / `--success` / `--warning`：同 DaisyUI error/success/warning
    - 陰影（藍色調）：`--shadow-soft: 0 1px 2px oklch(0.45 0.08 250 / 0.06), 0 2px 8px oklch(0.45 0.08 250 / 0.06)`；`--shadow-elevated: 0 6px 20px oklch(0.45 0.08 250 / 0.1), 0 2px 4px oklch(0.45 0.08 250 / 0.05)`；`--shadow-floating: 0 16px 40px oklch(0.45 0.08 250 / 0.16), 0 4px 12px oklch(0.45 0.08 250 / 0.08)`；暗色用 `oklch(0 0 0 / …)`，不透明度 ×3。
    - 科目變數（亮 / 暗）：

    | id | solid | content | tint | ink |
    | --- | --- | --- | --- | --- |
    | math | `0.56 0.16 252` / `0.7 0.14 248` | `1 0 0` / `0.18 0.04 255` | `0.94 0.035 250` / `0.32 0.07 252` | `0.4 0.12 252` / `0.88 0.06 248` |
    | chinese | `0.6 0.18 30` / `0.72 0.15 30` | 同上 | `0.94 0.035 30` / `0.33 0.07 30` | `0.45 0.15 30` / `0.88 0.06 30` |
    | english | `0.55 0.18 295` / `0.72 0.14 295` | 同上 | `0.94 0.035 295` / `0.33 0.08 295` | `0.42 0.16 295` / `0.88 0.06 295` |
    | science | `0.58 0.14 155` / `0.74 0.14 155` | 同上 | `0.94 0.04 155` / `0.33 0.06 155` | `0.42 0.11 155` / `0.88 0.07 155` |
    | social-studies | `0.76 0.15 75` / `0.8 0.14 75` | `0.3 0.07 60` / `0.18 0.04 255` | `0.95 0.045 80` / `0.34 0.06 75` | `0.48 0.11 65` / `0.9 0.07 80` |

    （全部寫成 `oklch(…)`。）
    - 刪除沒人用的 token：`--muted`、`--sidebar-bg`、`--accent-foreground`、全部 `--glass-*`，以及 `@theme` 中對應的 `--color-muted`、`--color-sidebar-bg`。保留 `--muted-foreground`、`--shadow-floating`（`ConfirmModal` 在用）。
  - `@layer components`：刪 `.glass`、`.glass-panel`、`.pill`、`.focus-ring`；`@layer utilities` 刪 `.text-secondary`、`.backdrop-strong`（皆無引用）。改寫：

    ```css
    .surface-card {
      background: var(--card);
      border: 1px solid var(--border-hairline);
      box-shadow: var(--shadow-soft);
    }

    .toolbar {
      background: var(--card);
      border-bottom: 1px solid var(--border-hairline);
    }
    ```

  - customizable select 那段註解改為「觸發器若有半透明背景…」的中性說法（玻璃已移除，但規則保留以防 inherit 透明）。
  - 字體：`@theme` 加

    ```css
    --font-sans: var(--font-noto-tc), ui-sans-serif, system-ui, sans-serif;
    --font-display: var(--font-huninn), var(--font-noto-tc), ui-sans-serif, sans-serif;
    ```

    `@layer base` 加

    ```css
    h1, h2, h3 {
      font-family: var(--font-display);
      /* 粉圓只有 400，禁止瀏覽器合成假粗體。 */
      font-synthesis: none;
    }
    ```

- [ ] **Step 5:** `app/layout.tsx` 載入字體：

```tsx
import { Huninn, Noto_Sans_TC } from "next/font/google";

// 兩套字都沒有中文 subset：不預載，瀏覽器依 unicode-range 只下載頁面用到的字。
const huninn = Huninn({ weight: "400", variable: "--font-huninn", preload: false, display: "swap" });
const notoSansTC = Noto_Sans_TC({ variable: "--font-noto-tc", preload: false, display: "swap" });
```

`<html>` 加 `className={`${huninn.variable} ${notoSansTC.variable}`}`。

- [ ] **Step 6:** `npx vitest run && npx tsc --noEmit && npx eslint` → 全過；`grep -rn "ollie\(light\|dark\)\|glass" app components contexts` 無結果。
- [ ] **Step 7:** commit `feat(theme): paopao light/dark themes, fonts, drop glass`

### Task 3: 科目顏色套到考古題頁

**Files:**
- Modify: `components/PastExams/SegmentButton.tsx`、`components/PastExams/CollectionPicker.tsx:58-66`、`components/PastExams/PastExamsPage.tsx:113-119`
- Test: `components/PastExams/PastExamsPage.test.tsx`

**Interfaces:**
- Consumes: `subjectColors` (Task 1)
- Produces: `SegmentButton` 新增選用 prop `colors?: SubjectColors`

- [ ] **Step 1: 寫失敗測試**（加到 `PastExamsPage.test.tsx`，沿用檔案現有的 render helper 與 fixture；選中的科目按鈕帶科目變數、標題有科目標籤）

```tsx
it("paints the selected subject and the heading tag in the subject colour", async () => {
  await renderPage(); // 檔案內既有的 render helper；fixture 目前科目為 math
  const pressed = [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find(
    (button) => button.textContent === "數學",
  )!;
  expect(pressed.style.getPropertyValue("--btn-color")).toBe("var(--subject-math)");
  expect(pressed.style.getPropertyValue("--btn-fg")).toBe("var(--subject-math-content)");
  expect(pressed.className).not.toContain("btn-primary");

  const tag = container.querySelector<HTMLElement>("header [data-subject-tag]")!;
  expect(tag.textContent).toBe("數學");
  expect(tag.style.backgroundColor).toBe("var(--subject-math-tint)");
});
```

（若 helper 名稱不同，改用檔案中實際 render 函式；斷言不變。）

- [ ] **Step 2:** `npx vitest run components/PastExams` → FAIL
- [ ] **Step 3:** `SegmentButton`：

```tsx
import type { SubjectColors } from "../../lib/pastExams/subjectColors";
// props 加 colors?: SubjectColors
const colored = pressed && colors;
<button
  className={`btn join-item btn-sm px-3 ${pressed && !colors ? "btn-primary" : ""}`}
  style={colored ? ({ "--btn-color": colors.solid, "--btn-fg": colors.content } as React.CSSProperties) : undefined}
  …
```

`CollectionPicker` 科目鈕傳 `colors={subjectColors(subject)}`。

`PastExamsPage` 標題副行把科目名稱換成標籤：

```tsx
const colors = subjectColors(collection.subject);
…
<p className="flex flex-wrap items-center gap-1.5 text-sm text-base-content/60">
  <span>{termLabel(collection.grade, collection.semester)}</span>
  <span
    data-subject-tag
    className="rounded-full px-2 py-0.5 text-xs font-medium"
    style={{ backgroundColor: colors.tint, color: colors.ink }}
  >
    {subjectLabel(collection.subject, catalog.datasets)}
  </span>
  <span>（{collection.publisherLabel}），共 {collectionExams.length} 份</span>
</p>
```

- [ ] **Step 4:** `npx vitest run` → PASS（既有測試若比對副行整段文字，改為比對各片段）
- [ ] **Step 5:** commit `feat(past-exams): colour subjects`

### Task 4: Logo 元件、頂部列與首頁

**Files:**
- Create: `components/common/Logo.tsx`
- Modify: `app/(app)/layout.tsx`、`app/page.tsx`

- [ ] **Step 1:** `Logo.tsx`：

```tsx
/** 泡泡考卷 logo：考卷右上角冒出兩顆泡泡。 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M18 14h17l9 9v25a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" fill="#fff" stroke="#2F9BF0" strokeWidth="3" strokeLinejoin="round" />
      <path d="M21 31h14M21 38h17M21 45h10" stroke="#9CCBF5" strokeWidth="3" strokeLinecap="round" />
      <circle cx="46" cy="18" r="8.5" fill="#3DD6B5" />
      <circle cx="43.5" cy="15.5" r="2.2" fill="#fff" opacity="0.75" />
      <circle cx="55" cy="7" r="4" fill="#2F9BF0" />
    </svg>
  );
}
```

- [ ] **Step 2:** 頂部列：移除藍色方塊與 `Printer` import，換成 `<Logo className="size-8 shrink-0" />`；字樣 span 加 `font-display`、移除 `font-semibold`。
- [ ] **Step 3:** 首頁 `<nav>` 上方加：

```tsx
<div className="mb-8 flex flex-col items-center gap-3">
  <Logo className="size-20" />
  <h1 className="text-3xl">泡泡考卷</h1>
</div>
```

（外層改為 `flex-col` 容器包住 logo 區與 nav；連結 class 加 `font-display`。）

- [ ] **Step 4:** `npx tsc --noEmit && npx eslint && npx vitest run` → 全過
- [ ] **Step 5:** commit `feat(theme): 泡泡考卷 logo in header and home page`

### Task 5: favicon、icon.svg、apple-icon

**Files:**
- Create: `app/icon.svg`、`scripts/generate-icons.mjs`、`app/apple-icon.png`（產物）
- Replace: `app/favicon.ico`（產物）
- Modify: `package.json`（devDependency `sharp`、script `icons`）

- [ ] **Step 1:** `app/icon.svg`（簡化版，16px 可辨識）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2F9BF0"/>
  <rect x="13" y="15" width="28" height="36" rx="4" fill="#fff"/>
  <circle cx="44" cy="20" r="10" fill="#3DD6B5" stroke="#2F9BF0" stroke-width="3"/>
  <circle cx="53.5" cy="8.5" r="4" fill="#fff"/>
</svg>
```

- [ ] **Step 2:** `npm i -D sharp`
- [ ] **Step 3:** `scripts/generate-icons.mjs`：

```js
// 由 app/icon.svg 產生 app/favicon.ico（16、32px，內嵌 PNG）與 app/apple-icon.png（180px，滿版不透明）。
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url));
const png = (size, input = svg) => sharp(input, { density: 72 * (size / 64) * 4 }).resize(size, size).png().toBuffer();

const images = await Promise.all([16, 32].map((size) => png(size)));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const size = [16, 32][i];
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));

// iOS 會自己裁圓角：用直角滿版底色。
const square = Buffer.from(svg.toString().replace('rx="14" ', ""));
await writeFile(new URL("../app/apple-icon.png", import.meta.url), await png(180, square));
```

`package.json` scripts 加 `"icons": "node scripts/generate-icons.mjs"`。

- [ ] **Step 4:** `npm run icons`；用 Read 看 `app/apple-icon.png` 確認圖樣正確；`file`/大小檢查 `app/favicon.ico` 非空。
- [ ] **Step 5:** commit `feat(theme): 泡泡考卷 favicon and app icons`

### Task 6: 瀏覽器驗證

- [ ] **Step 1:** dev server（port 6789）：`/favicon.ico`、`/icon.svg`、`/apple-icon.png` 皆 200；`<head>` 有對應 `<link rel="icon">`、`<link rel="apple-touch-icon">`。
- [ ] **Step 2:** 亮色、暗色各截圖：`/`、`/past-exams`（切換各科目，確認選中色與標題標籤）、`/my-exams`、`/my-exams/sheets/new`、`/my-exams/sources/<id>`（若無資料則跳過並註記）、列印頁。檢查：無殘留玻璃半透明、文字對比正常、h1 為粉圓且無假粗體、console 無錯誤。
- [ ] **Step 3:** 列印頁用 `emulateMedia print` 或 print CSS 檢查 body 背景為白。
- [ ] **Step 4:** 修正發現的問題並各自 commit；最後 `npx vitest run && npx tsc --noEmit && npx eslint` 全過。
