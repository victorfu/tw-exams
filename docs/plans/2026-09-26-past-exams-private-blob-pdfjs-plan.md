# 考古題：output 進 repo、私有 Vercel Blob、pdf.js 預覽 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 cowork 的 `output/` 搬進 repo（meta 進 git、考卷檔不進），考卷檔放私有 Vercel Blob，並經由本站 `/exams` 路由（嚴格來源檢查）提供給 pdf.js 預覽器。

**Architecture:** `output/` 是唯一來源：`npm run dev`／`build` 前由 `scripts/build-exam-catalog.ts` 產生 `data/pastExams.json`。`app/exams/[...path]/route.ts` 依 `EXAMS_FILE_SOURCE` 從 `output/`（開發）或私有 Blob（線上）讀檔，只給 catalog 裡已下載的考卷、只接受本站頁面發出的請求。`PdfViewer` 用 pdf.js 把 PDF 畫在 canvas 上。`npm run upload:exams` 把 `output/` 的考卷檔同步到 Blob 的 `exams/<relative_path>`。

**Tech Stack:** Next.js 16.3.6（App Router）、React 19、TypeScript、Tailwind v4＋daisyUI 5、pdfjs-dist 5、@vercel/blob 2.8、vitest 4（jsdom／node）、Node 24（直接執行 TS）。

**Spec:** `docs/plans/2026-09-26-past-exams-private-blob-pdfjs-design.md`

## Global Constraints

- Node 固定 24.x：`package.json` 的 `"engines": { "node": "24.x" }`。
- `scripts/*.ts` 用 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON` 直接執行（型別剝除）：scripts 與它們在執行時 import 的 lib 檔，相對 import 要寫 `.ts` 副檔名；型別只能用 `import type` 或 `type` 修飾；不能用 enum、namespace、parameter property。
- Next 16.3.6：用任何 Next API 前先讀 `node_modules/next/dist/docs/`；route handler 的 `params` 是 Promise，要 `await`。
- `@vercel/blob` `^2.8.0` 放 `dependencies`。私有 store；pathname 一律 `exams/<relative_path>`；`put` 要明確傳 `addRandomSuffix: false`（SDK 預設是 true）與 `allowOverwrite: true`。
- Blob 憑證來自 `.env.local`（`npx vercel env pull .env.local` 產生的 `VERCEL_OIDC_TOKEN`＋`BLOB_STORE_ID`）或 `BLOB_READ_WRITE_TOKEN`；絕不印出或 commit 它們的值。
- `EXAMS_FILE_SOURCE`：值是 `blob` 讀 Blob，其他（包括沒設）讀 `output/`；`.env.development` 是 `local`、`.env.production` 是 `blob`，兩者都 commit。
- 嚴格來源檢查：只接受 `Sec-Fetch-Site: same-origin`；沒有這個 header 時，只接受同源的 `Referer`。
- `components/` 與 `lib/` 用相對 import（vitest 沒有 `@/` alias）；`app/` 裡的檔案可以用 `@/`。
- ESLint 的 `react-hooks/set-state-in-effect`、`react-hooks/refs` 是 error：effect 本體不能同步呼叫 setState（callback 裡可以）；render 時不能讀 ref。
- 樣式只用現有 class 與 token（`surface-card`、`border-border-hairline`、`bg-base-200`、daisyUI 的 `btn`／`join`／`loading`）；不碰主題檔。
- 文案（逐字）：路由 403 內容「請從考古題頁面開啟這份考卷。」；預覽器錯誤「找不到這份考卷的檔案（可能還沒上傳）」「請從考古題頁面開啟這份考卷」「PDF 載入失敗」；按鈕與標籤「重試」「在新分頁開啟」「縮小」「放大」「適合寬度」「第 N 頁」「載入 PDF」。
- 上傳預估進階操作超過 1,500 次時要警告（Hobby 每月 2,000 次）。
- 每個 commit 訊息結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`；只 stage 該 task 列出的檔案。
- 沒有使用者在對話中明確同意，不刪 `C:\Users\Victor\Downloads\output`、不 push、不部署。

## Review Focus

1. 快速連按 → 換考卷時，上一份 PDF 還沒下載完：舊的那份不能畫到新考卷上，而且要被釋放（Task 6 測試「drops a slow download when the exam changes」）。
2. 預覽區寬度是 0（手機上預覽層關著、元素被隱藏）：不能嘗試渲染、不能出錯（Task 6 測試「does not render while the viewer has no width」）。
3. Blob 上超過 1,000 個檔案：列清單要跟著 cursor 翻頁，否則會重傳已存在的檔案（Task 8 測試「listAllBlobs follows cursors until the last page」）。
4. `vercel env pull` 拿到的 OIDC 憑證過期（約 12 小時）：上傳要給出「重新執行 env pull」的具體指示，不是一串 SDK 錯誤（Task 8 測試「explains how to refresh credentials when the store cannot be read」）。
5. 檔名含空白或中文：Next 交給路由的是解碼後的路徑段，仍要找得到 catalog 裡的考卷（Task 4 測試「serves files whose names Next.js hands over decoded」）。

---

### Task 1: output 搬進 repo、git 規則、env 檔

**Files:**
- Create: `output/**`（從 `C:\Users\Victor\Downloads\output` 複製；只有 meta 進 git）
- Create: `.env.development`、`.env.production`
- Modify: `.gitignore`
- Modify（本機、不進 git）：`.env.local`（刪 `EXAMS_SOURCE_DIR`）
- Delete（本機）：`public/exams/`

**Interfaces:**
- Consumes: 無
- Produces: `output/catalog-info.json`、`output/catalog.jsonl`（Task 2 讀）；`output/<relative_path>` 考卷檔（Task 4、8 讀）；`EXAMS_FILE_SOURCE`（Task 4、5 讀）

- [ ] **Step 1: 複製資料並比對雜湊**

```bash
cp -r /c/Users/Victor/Downloads/output /d/Documents/tw-exams/output
SP=/c/Users/Victor/AppData/Local/Temp/claude/D--Documents-tw-exams/0c5e03fa-4437-48ce-aa96-0ab25392862c/scratchpad
( cd /c/Users/Victor/Downloads/output && find . -type f -print0 | sort -z | xargs -0 sha256sum ) > "$SP/output-src.sha"
( cd /d/Documents/tw-exams/output && find . -type f -print0 | sort -z | xargs -0 sha256sum ) > "$SP/output-dst.sha"
cmp "$SP/output-src.sha" "$SP/output-dst.sha" && wc -l < "$SP/output-dst.sha"
```

Expected: `cmp` 沒有輸出，最後印出 `201`。

- [ ] **Step 2: 改 `.gitignore`**

把

```gitignore
# env files (can opt-in for committing if needed)
.env*
```

換成

```gitignore
# env：預設值檔（.env.development、.env.production）進 git；機密與個人設定不進
/.env
.env*.local
```

把

```gitignore
# past exams (synced from cowork output by `npm run sync:exams`)
/public/exams/
```

換成

```gitignore
# cowork 的考卷資料：只追蹤 meta（.json／.jsonl／.md），考卷檔不進 git
/output/**
!/output/**/
!/output/**/*.json
!/output/**/*.jsonl
!/output/**/*.md
```

- [ ] **Step 3: 驗證忽略規則**

```bash
git check-ignore -q output/pdf/math-grade-05-semester-1-nani/20002871b5148af7683e.pdf && echo pdf-ignored
git check-ignore -q output/doc/math-grade-05-semester-1-nani/10029955e37987aea849.docx && echo docx-ignored
git check-ignore -q .env.local && echo env-local-ignored
git check-ignore output/catalog.jsonl output/pdf/math-grade-05-semester-1-nani/manifest.json .env.development .env.production || echo meta-and-defaults-not-ignored
git add -n output | wc -l
```

Expected: 印出 `pdf-ignored`、`docx-ignored`、`env-local-ignored`、`meta-and-defaults-not-ignored`，最後是 `9`。

- [ ] **Step 4: 建 env 預設值檔**

`.env.development`：

```dotenv
# 開發：/exams 路由直接讀 repo 內的 output/。想在本機測 Blob，就在 .env.development.local 設 EXAMS_FILE_SOURCE=blob。
EXAMS_FILE_SOURCE=local
```

`.env.production`：

```dotenv
# 線上：/exams 路由從私有 Vercel Blob 讀（store 要連到 Vercel 專案，憑證由 Vercel 提供）。
EXAMS_FILE_SOURCE=blob
```

- [ ] **Step 5: 清掉舊設定與舊複本**

```bash
sed -i '/^EXAMS_SOURCE_DIR=/d' .env.local
sed -E 's/=.*/=<redacted>/' .env.local
rm -rf public/exams
ls public
```

Expected: `.env.local` 只剩 `BLOB_STORE_ID`、`BLOB_WEBHOOK_PUBLIC_KEY`、`VERCEL_OIDC_TOKEN`（值已遮蔽）；`public/` 裡沒有 `exams`。

- [ ] **Step 6: 詢問是否刪除 Downloads 那份**

在對話中告訴使用者：201 個檔的 SHA-256 全部相符，請求明確同意後才執行：

```bash
rm -rf /c/Users/Victor/Downloads/output
```

沒有得到明確同意就保留，繼續下一步。

- [ ] **Step 7: Commit**

```bash
git add .gitignore .env.development .env.production output
git status --short
git commit -m "chore(past-exams): move cowork output into the repo, track only its metadata

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `git status --short` 列出 `.gitignore`、兩個 env 檔、9 個 `output/` meta 檔；沒有任何 PDF／DOC。

---

### Task 2: 從 output/ 產生目錄（取代同步腳本）

**Files:**
- Create: `testing/fakeExamOutput.ts`
- Create: `scripts/examCatalog.ts`、`scripts/examCatalog.test.ts`、`scripts/build-exam-catalog.ts`
- Create: `lib/pastExams/examIndex.ts`、`lib/pastExams/examIndex.test.ts`
- Modify: `lib/pastExams/catalog.ts`
- Modify: `package.json`、`.gitignore`
- Delete: `scripts/sync-exams.ts`、`scripts/syncExams.ts`、`scripts/syncExams.test.ts`；`data/pastExams.json` 從 git 移除（本機保留）

**Interfaces:**
- Consumes: `parseCatalogJsonl(text): CatalogRecord[]`、`buildCatalog(info: CatalogInfo, records): PastExamCatalog`（`lib/pastExams/buildCatalog.ts`，已存在）
- Produces:
  - `readOutputCatalog(outputDir: string): Promise<PastExamCatalog>`（Task 4 測試、Task 8 使用）
  - `generateExamCatalog(options: { outputDir: string; dataFile: string }): Promise<PastExamCatalog>`
  - `writeFakeOutput(dir: string, exams: FakeExamFile[], options?: { recordCount?: number }): Promise<void>`，`FakeExamFile = { id: string; path: string; content?: string; downloaded?: boolean; bytes?: number | null; title?: string }`（Task 4、8 測試使用）
  - `createAvailableExamLookup(exams: readonly PastExam[]): (file: string) => PastExam | undefined`
  - `findAvailableExamByFile(file: string): PastExam | undefined`（`lib/pastExams/catalog.ts`，Task 4 使用）

- [ ] **Step 1: 建測試用的假 output 產生器**

`testing/fakeExamOutput.ts`：

```ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface FakeExamFile {
  id: string;
  /** relative_path，例如 pdf/ds/a.pdf。 */
  path: string;
  /** 考卷檔內容；catalog 的 bytes 依它計算。 */
  content?: string;
  downloaded?: boolean;
  /** 覆寫 catalog 的 bytes（模擬大小不符）。 */
  bytes?: number | null;
  title?: string;
}

/** 在 dir 建一份假的 cowork output：catalog-info.json、catalog.jsonl 與已下載的考卷檔。 */
export async function writeFakeOutput(
  dir: string,
  exams: FakeExamFile[],
  { recordCount = exams.length }: { recordCount?: number } = {},
): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const info = {
    schema_version: 1,
    generated_at: "2026-09-26T10:00:00+08:00",
    record_count: recordCount,
    datasets: [
      { id: "ds", subject: "math", subject_label: "數學", grade: 5, semester: 1, publisher: "nani", publisher_label: "南一" },
    ],
  };
  await writeFile(join(dir, "catalog-info.json"), JSON.stringify(info));
  const lines: string[] = [];
  for (const exam of exams) {
    const downloaded = exam.downloaded ?? true;
    const content = exam.content ?? `content of ${exam.id}`;
    if (downloaded) {
      const target = join(dir, ...exam.path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    lines.push(
      JSON.stringify({
        schema_version: 1,
        record_id: exam.id,
        dataset_id: "ds",
        title: exam.title ?? exam.id,
        academic_year_roc: 114,
        academic_year_label: "114上",
        exam_type: "midterm",
        exam_type_label: "期中考",
        exam_round: 1,
        period_label: "期中1",
        city: "臺北市",
        school: "民權國小",
        question_file: {
          relative_path: exam.path,
          format: exam.path.split(".").pop(),
          downloaded,
          bytes: exam.bytes !== undefined ? exam.bytes : downloaded ? Buffer.byteLength(content) : null,
          page_count: 1,
        },
        search_text: exam.id,
      }),
    );
  }
  await writeFile(join(dir, "catalog.jsonl"), `${lines.join("\n")}\n`);
}
```

- [ ] **Step 2: 寫目錄產生的失敗測試**

`scripts/examCatalog.test.ts`：

```ts
// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFakeOutput } from "../testing/fakeExamOutput";
import { generateExamCatalog } from "./examCatalog";

let root: string;
let outputDir: string;
let dataFile: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "exam-catalog-"));
  outputDir = join(root, "output");
  dataFile = join(root, "data", "pastExams.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("generateExamCatalog", () => {
  it("writes the page catalog from output/ without needing the exam files", async () => {
    await writeFakeOutput(outputDir, [
      { id: "a", path: "pdf/ds/a.pdf" },
      { id: "b", path: "doc/ds/b.docx", downloaded: false },
    ]);
    await rm(join(outputDir, "pdf"), { recursive: true, force: true });

    const catalog = await generateExamCatalog({ outputDir, dataFile });

    expect(catalog.exams.map((exam) => [exam.id, exam.available])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(JSON.parse(await readFile(dataFile, "utf8"))).toEqual(catalog);
  });

  it("fails on a broken catalog and leaves the existing file untouched", async () => {
    await writeFakeOutput(outputDir, [{ id: "a", path: "pdf/ds/a.pdf" }], { recordCount: 3 });
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(dataFile, "old");

    await expect(generateExamCatalog({ outputDir, dataFile })).rejects.toThrow(/record_count/);
    expect(await readFile(dataFile, "utf8")).toBe("old");
  });
});
```

- [ ] **Step 3: 執行，確認失敗**

Run: `npx vitest run scripts/examCatalog.test.ts`
Expected: FAIL，`Cannot find module './examCatalog'`（或 Failed to resolve import）。

- [ ] **Step 4: 實作 `scripts/examCatalog.ts`**

```ts
// 從 repo 內 cowork 的 output/ 產生頁面用的目錄。Node 直接跑 TS，所以相對 import 要寫 .ts 副檔名。
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildCatalog, parseCatalogJsonl, type CatalogInfo } from "../lib/pastExams/buildCatalog.ts";
import type { PastExamCatalog } from "../lib/pastExams/types.ts";

/** 讀 output/ 的 catalog-info.json 與 catalog.jsonl，驗證後精簡成頁面用的目錄；不檢查考卷檔。 */
export async function readOutputCatalog(outputDir: string): Promise<PastExamCatalog> {
  const info = JSON.parse(await readFile(join(outputDir, "catalog-info.json"), "utf8")) as CatalogInfo;
  const records = parseCatalogJsonl(await readFile(join(outputDir, "catalog.jsonl"), "utf8"));
  return buildCatalog(info, records);
}

/** 產生 dataFile；先寫暫存檔再改名，任何錯誤都不動既有的檔案。 */
export async function generateExamCatalog({
  outputDir,
  dataFile,
}: {
  outputDir: string;
  dataFile: string;
}): Promise<PastExamCatalog> {
  const catalog = await readOutputCatalog(outputDir);
  await mkdir(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.tmp`;
  await writeFile(temporary, JSON.stringify(catalog));
  await rename(temporary, dataFile);
  return catalog;
}
```

- [ ] **Step 5: 執行，確認通過**

Run: `npx vitest run scripts/examCatalog.test.ts`
Expected: PASS（2 tests）。

- [ ] **Step 6: 寫以檔案查考卷的失敗測試**

`lib/pastExams/examIndex.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { makeExam } from "../../testing/pastExamsFixtures";
import { createAvailableExamLookup } from "./examIndex";

describe("createAvailableExamLookup", () => {
  it("finds downloaded exams by their file path only", () => {
    const pdf = makeExam({ file: "pdf/ds/a.pdf" });
    const notDownloaded = makeExam({ file: "pdf/ds/b.pdf", available: false });
    const find = createAvailableExamLookup([pdf, notDownloaded]);

    expect(find("pdf/ds/a.pdf")).toBe(pdf);
    expect(find("pdf/ds/b.pdf")).toBeUndefined();
    expect(find("catalog.jsonl")).toBeUndefined();
  });
});
```

Run: `npx vitest run lib/pastExams/examIndex.test.ts`
Expected: FAIL，找不到 `./examIndex`。

- [ ] **Step 7: 實作 `lib/pastExams/examIndex.ts` 並接到 `catalog.ts`**

`lib/pastExams/examIndex.ts`：

```ts
import type { PastExam } from "./types";

/** 以檔案路徑查已下載的考卷；/exams 路由只提供查得到的檔案。 */
export function createAvailableExamLookup(exams: readonly PastExam[]): (file: string) => PastExam | undefined {
  const byFile = new Map(exams.filter((exam) => exam.available).map((exam) => [exam.file, exam]));
  return (file) => byFile.get(file);
}
```

`lib/pastExams/catalog.ts` 整個換成：

```ts
import data from "../../data/pastExams.json";
import { createAvailableExamLookup } from "./examIndex";
import type { PastExamCatalog } from "./types";

/** `npm run catalog`（dev／build 前自動執行）從 output/ 產生的考古題目錄；build 時打包。 */
export const pastExamCatalog = data as PastExamCatalog;

export const findAvailableExamByFile = createAvailableExamLookup(pastExamCatalog.exams);
```

Run: `npx vitest run lib/pastExams/examIndex.test.ts`
Expected: PASS。

- [ ] **Step 8: CLI、npm scripts、移除同步腳本**

`scripts/build-exam-catalog.ts`：

```ts
// 用法：npm run catalog（npm run dev／build 前會自動執行）
// 從 output/ 產生 data/pastExams.json；catalog 有問題就失敗，dev／build 跟著停。
import { join, resolve } from "node:path";
import { generateExamCatalog } from "./examCatalog.ts";

const repoRoot = resolve(import.meta.dirname, "..");
try {
  const catalog = await generateExamCatalog({
    outputDir: join(repoRoot, "output"),
    dataFile: join(repoRoot, "data", "pastExams.json"),
  });
  console.log(`考古題目錄：${catalog.datasets.length} 個資料集、${catalog.exams.length} 份考卷 → data/pastExams.json`);
} catch (error) {
  console.error(`產生考古題目錄失敗：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
```

`package.json`：在 `"private": true,` 後面加 `"engines": { "node": "24.x" },`；`scripts` 裡刪掉 `"sync:exams"`，加入：

```json
    "catalog": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-exam-catalog.ts",
    "predev": "npm run catalog",
    "prebuild": "npm run catalog",
```

`.gitignore` 在 output 規則後面加：

```gitignore

# npm run catalog 從 output/ 產生
/data/pastExams.json
```

```bash
git rm -q scripts/sync-exams.ts scripts/syncExams.ts scripts/syncExams.test.ts
git rm -q --cached data/pastExams.json
npm run catalog
```

Expected: 印出 `考古題目錄：1 個資料集、192 份考卷 → data/pastExams.json`；`data/pastExams.json` 仍在本機。

- [ ] **Step 9: 全部測試**

Run: `npm test`
Expected: 全部通過（同步腳本的測試已刪除）。

- [ ] **Step 10: Commit**

```bash
git add testing/fakeExamOutput.ts scripts/examCatalog.ts scripts/examCatalog.test.ts scripts/build-exam-catalog.ts lib/pastExams/examIndex.ts lib/pastExams/examIndex.test.ts lib/pastExams/catalog.ts package.json .gitignore
git commit -m "feat(past-exams): generate the catalog from output/ before dev and build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 檔案網址、來源檢查、回應 header（純函式）

**Files:**
- Modify: `lib/pastExams/fileUrl.ts`、`lib/pastExams/fileUrl.test.ts`
- Create: `lib/pastExams/fileAccess.ts`、`lib/pastExams/fileAccess.test.ts`
- Create: `lib/pastExams/fileResponse.ts`、`lib/pastExams/fileResponse.test.ts`

**Interfaces:**
- Consumes: `PastExam`（`lib/pastExams/types.ts`）
- Produces:
  - `examFileUrl(file: string, options?: { download?: boolean }): string`
  - `isSameOriginRequest(headers: Headers, requestUrl: string): boolean`
  - `contentTypeFor(file: string): string`
  - `downloadFileName(exam: PastExam): string`
  - `contentDisposition(exam: PastExam, download: boolean): string`
  - `EXAM_FILE_SECURITY_HEADERS: Readonly<Record<string, string>>`

- [ ] **Step 1: 改 `fileUrl.test.ts`（失敗測試）**

整個換成：

```ts
import { describe, expect, it } from "vitest";
import { examFileUrl } from "./fileUrl";

describe("examFileUrl", () => {
  it("serves through /exams, encoding each path segment", () => {
    expect(examFileUrl("pdf/ds/考卷 #1.pdf")).toBe("/exams/pdf/ds/%E8%80%83%E5%8D%B7%20%231.pdf");
  });

  it("asks for a download with ?download=1", () => {
    expect(examFileUrl("doc/ds/a.docx", { download: true })).toBe("/exams/doc/ds/a.docx?download=1");
  });
});
```

- [ ] **Step 2: 寫 `fileAccess.test.ts`（失敗測試）**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./fileAccess";

const url = "https://tw-exams.vercel.app/exams/pdf/ds/a.pdf";

describe("isSameOriginRequest", () => {
  it("accepts requests from the site's own pages", () => {
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-origin" }), url)).toBe(true);
  });

  it.each(["none", "same-site", "cross-site"])("rejects Sec-Fetch-Site %s even with a same-origin Referer", (site) => {
    const headers = new Headers({ "sec-fetch-site": site, referer: "https://tw-exams.vercel.app/past-exams" });
    expect(isSameOriginRequest(headers, url)).toBe(false);
  });

  it("falls back to a same-origin Referer when Sec-Fetch-Site is missing", () => {
    expect(isSameOriginRequest(new Headers({ referer: "https://tw-exams.vercel.app/past-exams?id=1" }), url)).toBe(true);
  });

  it.each([["https://evil.example/page"], ["not a url"]])("rejects a Referer %s", (referer) => {
    expect(isSameOriginRequest(new Headers({ referer }), url)).toBe(false);
  });

  it("rejects when neither header is present", () => {
    expect(isSameOriginRequest(new Headers(), url)).toBe(false);
  });
});
```

- [ ] **Step 3: 寫 `fileResponse.test.ts`（失敗測試）**

```ts
import { describe, expect, it } from "vitest";
import { makeExam } from "../../testing/pastExamsFixtures";
import { contentDisposition, contentTypeFor, downloadFileName, EXAM_FILE_SECURITY_HEADERS } from "./fileResponse";

describe("contentTypeFor", () => {
  it.each([
    ["pdf/ds/a.pdf", "application/pdf"],
    ["doc/ds/a.doc", "application/msword"],
    ["doc/ds/a.DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["pdf/ds/a", "application/octet-stream"],
  ])("%s → %s", (file, type) => {
    expect(contentTypeFor(file)).toBe(type);
  });
});

describe("downloadFileName", () => {
  it("uses the title and the file name's own extension", () => {
    expect(downloadFileName(makeExam({ title: "考卷", file: "doc/ds/a.docx", format: "word" }))).toBe("考卷.docx");
  });

  it("falls back to the format when the file name has no extension", () => {
    expect(downloadFileName(makeExam({ title: "考卷", file: "pdf/v1.2/20002871" }))).toBe("考卷.pdf");
  });
});

describe("contentDisposition", () => {
  const exam = makeExam({ title: "114上｜臺北市 民權國小｜期中1", file: "pdf/ds/20002871b5148af7683e.pdf" });

  it("gives an ASCII fallback name and the UTF-8 title", () => {
    expect(contentDisposition(exam, false)).toBe(
      `inline; filename="20002871b5148af7683e.pdf"; filename*=UTF-8''${encodeURIComponent("114上｜臺北市 民權國小｜期中1.pdf")}`,
    );
  });

  it("asks for a download when requested", () => {
    expect(contentDisposition(exam, true)).toMatch(/^attachment; filename="20002871b5148af7683e\.pdf"; /);
  });

  it("percent-encodes characters RFC 5987 does not allow", () => {
    const odd = makeExam({ title: "考卷(1)*'", file: "pdf/ds/a.pdf" });
    expect(contentDisposition(odd, false)).toContain("filename*=UTF-8''%E8%80%83%E5%8D%B7%281%29%2A%27.pdf");
  });
});

describe("EXAM_FILE_SECURITY_HEADERS", () => {
  it("keeps files to this site and out of search engines, without CORS headers", () => {
    expect(EXAM_FILE_SECURITY_HEADERS).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Robots-Tag": "noindex, nofollow",
    });
    expect(Object.keys(EXAM_FILE_SECURITY_HEADERS).some((key) => key.toLowerCase().startsWith("access-control"))).toBe(false);
  });
});
```

- [ ] **Step 4: 執行，確認失敗**

Run: `npx vitest run lib/pastExams/fileUrl.test.ts lib/pastExams/fileAccess.test.ts lib/pastExams/fileResponse.test.ts`
Expected: FAIL——`fileUrl` 的 `?download=1` 測試失敗（第一個測試已經通過，是保留下來的行為）；另外兩個檔找不到模組。

- [ ] **Step 5: 實作三個模組**

`lib/pastExams/fileUrl.ts` 整個換成：

```ts
/** 考卷檔的網址：一律經過本站的 /exams 路由（開發讀 output/，線上讀私有 Blob）。 */
export function examFileUrl(file: string, { download = false }: { download?: boolean } = {}): string {
  const path = `/exams/${file.split("/").map(encodeURIComponent).join("/")}`;
  return download ? `${path}?download=1` : path;
}
```

`lib/pastExams/fileAccess.ts`：

```ts
/**
 * 嚴格來源檢查：只接受本站頁面發出的請求。
 * 有 Sec-Fetch-Site 時必須是 same-origin（直接輸入網址是 none，其他網站是 cross-site）；
 * 較舊的瀏覽器沒有這個 header，就改看 Referer 是不是同源。
 */
export function isSameOriginRequest(headers: Headers, requestUrl: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const referer = headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
```

`lib/pastExams/fileResponse.ts`：

```ts
import type { PastExam } from "./types";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** 檔名本身的副檔名（不看資料夾名稱）；沒有時回傳 null。 */
function extensionOf(file: string): string | null {
  return /\.([^./]+)$/.exec(file)?.[1] ?? null;
}

/** 依副檔名決定 Content-Type；不認得的一律當成二進位檔。 */
export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[extensionOf(file)?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** 下載檔名：考卷標題＋副檔名；檔名沒有副檔名時依格式補上。 */
export function downloadFileName(exam: PastExam): string {
  return `${exam.title}.${extensionOf(exam.file) ?? (exam.format === "pdf" ? "pdf" : "doc")}`;
}

/** RFC 6266：ASCII 後備檔名（原始檔名）加上 UTF-8 的中文標題。 */
export function contentDisposition(exam: PastExam, download: boolean): string {
  const fallback = (exam.file.split("/").pop() ?? "exam").replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(downloadFileName(exam)).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** 只讓本站嵌入與讀取、不被搜尋引擎收錄；刻意不送任何 Access-Control-* header。 */
export const EXAM_FILE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Robots-Tag": "noindex, nofollow",
};
```

- [ ] **Step 6: 執行，確認通過**

Run: `npx vitest run lib/pastExams/fileUrl.test.ts lib/pastExams/fileAccess.test.ts lib/pastExams/fileResponse.test.ts`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add lib/pastExams/fileUrl.ts lib/pastExams/fileUrl.test.ts lib/pastExams/fileAccess.ts lib/pastExams/fileAccess.test.ts lib/pastExams/fileResponse.ts lib/pastExams/fileResponse.test.ts
git commit -m "feat(past-exams): same-origin check and response headers for exam files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `/exams` 路由（output/ 與私有 Blob 兩種來源）

**Files:**
- Create: `lib/pastExams/examFileHandler.ts`、`lib/pastExams/examFileHandler.test.ts`
- Create: `lib/pastExams/fileSources.ts`
- Create: `app/exams/[...path]/route.ts`
- Modify: `package.json`、`package-lock.json`（`@vercel/blob`）

**Interfaces:**
- Consumes: `isSafeRelativePath`（`buildCatalog.ts`）、`isSameOriginRequest`、`contentTypeFor`、`contentDisposition`、`EXAM_FILE_SECURITY_HEADERS`（Task 3）、`findAvailableExamByFile`、`createAvailableExamLookup`、`readOutputCatalog`、`writeFakeOutput`（Task 2）
- Produces:
  - `type ExamFileReadResult = { status: 200; body: ReadableStream<Uint8Array>; size: number | null; etag: string | null } | { status: 304; etag: string | null } | { status: 404 }`
  - `interface ExamFileSource { cacheControl: string; read(file: string, ifNoneMatch: string | null): Promise<ExamFileReadResult> }`
  - `interface ExamFileHandlerDeps { findExam: (file: string) => PastExam | undefined; source: ExamFileSource }`
  - `FORBIDDEN_MESSAGE = "請從考古題頁面開啟這份考卷。"`
  - `handleExamFileRequest(request: Request, segments: readonly string[], deps: ExamFileHandlerDeps): Promise<Response>`
  - `BLOB_PREFIX = "exams/"`（Task 8 使用）
  - `type GetPrivateBlob`、`localExamFileSource(outputDir)`、`blobExamFileSource(getBlob)`、`examFileSourceFromEnv(env, { outputDir, getBlob })`

- [ ] **Step 1: 安裝 `@vercel/blob`**

```bash
npm install @vercel/blob@^2.8.0
grep -n '"@vercel/blob"' package.json
```

Expected: 出現在 `dependencies`。

- [ ] **Step 2: 寫路由邏輯的失敗測試**

`lib/pastExams/examFileHandler.test.ts`：

```ts
// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOutputCatalog } from "../../scripts/examCatalog";
import { writeFakeOutput } from "../../testing/fakeExamOutput";
import { FORBIDDEN_MESSAGE, handleExamFileRequest, type ExamFileHandlerDeps } from "./examFileHandler";
import { createAvailableExamLookup } from "./examIndex";
import { blobExamFileSource, examFileSourceFromEnv, localExamFileSource, type GetPrivateBlob } from "./fileSources";
import type { PastExam } from "./types";

const ORIGIN = "http://localhost:6789";
let root: string;
let outputDir: string;
let findExam: (file: string) => PastExam | undefined;

function request(path: string, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }): Request {
  return new Request(`${ORIGIN}/exams/${path}`, { headers });
}

function localDeps(): ExamFileHandlerDeps {
  return { findExam, source: localExamFileSource(outputDir) };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "exam-files-"));
  outputDir = join(root, "output");
  await writeFakeOutput(outputDir, [
    { id: "a", path: "pdf/ds/a.pdf", title: "114上｜臺北市 民權國小｜期中1", content: "%PDF-a" },
    { id: "b", path: "pdf/ds/b.pdf", downloaded: false },
    { id: "c", path: "doc/ds/c.docx", content: "docx" },
    { id: "d", path: "pdf/ds/考卷 1.pdf", content: "%PDF-d" },
  ]);
  findExam = createAvailableExamLookup((await readOutputCatalog(outputDir)).exams);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("handleExamFileRequest with output/", () => {
  it("serves a catalogued PDF inline with protective headers", async () => {
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], localDeps());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-a");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe("6");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="a.pdf"; filename*=UTF-8''${encodeURIComponent("114上｜臺北市 民權國小｜期中1.pdf")}`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect([...response.headers.keys()].some((key) => key.startsWith("access-control"))).toBe(false);
  });

  it("sends an attachment for ?download=1", async () => {
    const response = await handleExamFileRequest(request("doc/ds/c.docx?download=1"), ["doc", "ds", "c.docx"], localDeps());

    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="c\.docx"; /);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("serves files whose names Next.js hands over decoded", async () => {
    const response = await handleExamFileRequest(
      request("pdf/ds/%E8%80%83%E5%8D%B7%201.pdf"),
      ["pdf", "ds", "考卷 1.pdf"],
      localDeps(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-d");
  });

  it.each([
    ["not in the catalog", ["catalog.jsonl"]],
    ["unknown", ["pdf", "ds", "zzz.pdf"]],
    ["not downloaded", ["pdf", "ds", "b.pdf"]],
    ["escaping output/", ["..", "catalog.jsonl"]],
  ])("returns 404 for a file %s", async (_label, segments) => {
    const response = await handleExamFileRequest(request(segments.join("/")), segments, localDeps());
    expect(response.status).toBe(404);
  });

  it("returns 404 when a catalogued file is missing on disk", async () => {
    await rm(join(outputDir, "pdf", "ds", "a.pdf"));
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], localDeps());
    expect(response.status).toBe(404);
  });

  it.each([
    [{ "sec-fetch-site": "cross-site" }],
    [{ "sec-fetch-site": "none" }],
    [{ referer: "https://evil.example/page" }],
    [{}],
  ])("refuses requests that do not come from the site's own pages (%o)", async (headers) => {
    const read = vi.fn();
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf", headers), ["pdf", "ds", "a.pdf"], {
      findExam,
      source: { cacheControl: "no-store", read },
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe(FORBIDDEN_MESSAGE);
    expect(read).not.toHaveBeenCalled();
  });
});

describe("handleExamFileRequest with private Blob", () => {
  function blobDeps(getBlob: GetPrivateBlob): ExamFileHandlerDeps {
    return { findExam, source: blobExamFileSource(getBlob) };
  }

  it("streams the blob stored at exams/<relative_path>", async () => {
    const getBlob = vi.fn<GetPrivateBlob>(async () => ({
      statusCode: 200 as const,
      stream: new Response("%PDF-blob").body!,
      blob: { etag: '"e1"', size: 9 },
    }));

    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], blobDeps(getBlob));

    expect(getBlob).toHaveBeenCalledWith("exams/pdf/ds/a.pdf", { access: "private" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-blob");
    expect(response.headers.get("etag")).toBe('"e1"');
    expect(response.headers.get("content-length")).toBe("9");
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
  });

  it("passes the browser's ETag through and answers 304", async () => {
    const getBlob = vi.fn<GetPrivateBlob>(async () => ({ statusCode: 304 as const, blob: { etag: '"e1"' } }));

    const response = await handleExamFileRequest(
      request("pdf/ds/a.pdf", { "sec-fetch-site": "same-origin", "if-none-match": '"e1"' }),
      ["pdf", "ds", "a.pdf"],
      blobDeps(getBlob),
    );

    expect(getBlob).toHaveBeenCalledWith("exams/pdf/ds/a.pdf", { access: "private", ifNoneMatch: '"e1"' });
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"e1"');
    expect(await response.text()).toBe("");
  });

  it("returns 404 when the blob is missing", async () => {
    const getBlob = vi.fn<GetPrivateBlob>(async () => null);
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], blobDeps(getBlob));
    expect(response.status).toBe(404);
  });
});

describe("examFileSourceFromEnv", () => {
  it("reads Blob only when EXAMS_FILE_SOURCE is blob", () => {
    const getBlob = vi.fn<GetPrivateBlob>();
    expect(examFileSourceFromEnv({ EXAMS_FILE_SOURCE: "blob" }, { outputDir, getBlob }).cacheControl).toBe("private, no-cache");
    expect(examFileSourceFromEnv({ EXAMS_FILE_SOURCE: "local" }, { outputDir, getBlob }).cacheControl).toBe("no-store");
    expect(examFileSourceFromEnv({}, { outputDir, getBlob }).cacheControl).toBe("no-store");
  });
});
```

- [ ] **Step 3: 執行，確認失敗**

Run: `npx vitest run lib/pastExams/examFileHandler.test.ts`
Expected: FAIL，找不到 `./examFileHandler`／`./fileSources`。

- [ ] **Step 4: 實作 `lib/pastExams/examFileHandler.ts`**

```ts
import { isSafeRelativePath } from "./buildCatalog";
import { isSameOriginRequest } from "./fileAccess";
import { contentDisposition, contentTypeFor, EXAM_FILE_SECURITY_HEADERS } from "./fileResponse";
import type { PastExam } from "./types";

export type ExamFileReadResult =
  | { status: 200; body: ReadableStream<Uint8Array>; size: number | null; etag: string | null }
  | { status: 304; etag: string | null }
  | { status: 404 };

export interface ExamFileSource {
  /** 本機 no-store；Blob 用 private, no-cache（瀏覽器可快取，但每次都回來驗證）。 */
  cacheControl: string;
  read(file: string, ifNoneMatch: string | null): Promise<ExamFileReadResult>;
}

export interface ExamFileHandlerDeps {
  findExam: (file: string) => PastExam | undefined;
  source: ExamFileSource;
}

export const FORBIDDEN_MESSAGE = "請從考古題頁面開啟這份考卷。";

function textResponse(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/** /exams/<relative_path>：只提供 catalog 裡已下載的考卷，而且只給本站頁面。 */
export async function handleExamFileRequest(
  request: Request,
  segments: readonly string[],
  { findExam, source }: ExamFileHandlerDeps,
): Promise<Response> {
  const file = segments.join("/");
  if (!isSafeRelativePath(file)) return textResponse(404, "找不到這份考卷。");
  const exam = findExam(file);
  if (!exam) return textResponse(404, "找不到這份考卷。");
  if (!isSameOriginRequest(request.headers, request.url)) return textResponse(403, FORBIDDEN_MESSAGE);

  const result = await source.read(file, request.headers.get("if-none-match"));
  if (result.status === 404) return textResponse(404, "找不到這份考卷。");

  const headers = new Headers({ ...EXAM_FILE_SECURITY_HEADERS, "Cache-Control": source.cacheControl });
  if (result.etag) headers.set("ETag", result.etag);
  if (result.status === 304) return new Response(null, { status: 304, headers });

  const download = new URL(request.url).searchParams.get("download") === "1";
  headers.set("Content-Type", contentTypeFor(file));
  headers.set("Content-Disposition", contentDisposition(exam, download));
  if (result.size !== null) headers.set("Content-Length", String(result.size));
  return new Response(result.body, { status: 200, headers });
}
```

- [ ] **Step 5: 實作 `lib/pastExams/fileSources.ts`**

```ts
// 考卷檔的兩種來源。上傳腳本（Node 直接跑 TS）也會 import 這個檔，所以本地模組只能 import type。
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { Readable } from "node:stream";
import type { ExamFileReadResult, ExamFileSource } from "./examFileHandler";

/** 私有 Blob store 裡考卷檔的路徑前綴：exams/<relative_path>。 */
export const BLOB_PREFIX = "exams/";

/** 開發用：直接讀 repo 內的 output/。 */
export function localExamFileSource(outputDir: string): ExamFileSource {
  return {
    cacheControl: "no-store",
    async read(file): Promise<ExamFileReadResult> {
      const path = join(outputDir, ...file.split("/"));
      const inside = relative(outputDir, path);
      if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) return { status: 404 };
      try {
        const info = await stat(path);
        if (!info.isFile()) return { status: 404 };
        const body = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
        return { status: 200, body, size: info.size, etag: null };
      } catch {
        return { status: 404 };
      }
    },
  };
}

/** @vercel/blob 的 get() 用到的部分；測試時換成假的。 */
export type GetPrivateBlob = (
  pathname: string,
  options: { access: "private"; ifNoneMatch?: string },
) => Promise<
  | { statusCode: 200; stream: ReadableStream<Uint8Array>; blob: { etag: string; size: number } }
  | { statusCode: 304; blob: { etag: string } }
  | null
>;

/** 線上：從私有 Blob store 讀 exams/<relative_path>。 */
export function blobExamFileSource(getBlob: GetPrivateBlob): ExamFileSource {
  return {
    cacheControl: "private, no-cache",
    async read(file, ifNoneMatch): Promise<ExamFileReadResult> {
      const result = await getBlob(`${BLOB_PREFIX}${file}`, {
        access: "private",
        ...(ifNoneMatch ? { ifNoneMatch } : {}),
      });
      if (!result) return { status: 404 };
      if (result.statusCode === 304) return { status: 304, etag: result.blob.etag };
      return { status: 200, body: result.stream, size: result.blob.size, etag: result.blob.etag };
    },
  };
}

/** EXAMS_FILE_SOURCE 是 blob 才讀 Blob，其他（包括沒設）都讀 output/。 */
export function examFileSourceFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  { outputDir, getBlob }: { outputDir: string; getBlob: GetPrivateBlob },
): ExamFileSource {
  return env.EXAMS_FILE_SOURCE === "blob" ? blobExamFileSource(getBlob) : localExamFileSource(outputDir);
}
```

- [ ] **Step 6: 執行，確認通過**

Run: `npx vitest run lib/pastExams/examFileHandler.test.ts`
Expected: PASS。

- [ ] **Step 7: 路由檔**

先確認 Next 16 的寫法：`grep -n -A8 "params: Promise" node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`（`params` 是 Promise）。

`app/exams/[...path]/route.ts`：

```ts
import { join } from "node:path";
import { get } from "@vercel/blob";
import { findAvailableExamByFile } from "@/lib/pastExams/catalog";
import { handleExamFileRequest } from "@/lib/pastExams/examFileHandler";
import { examFileSourceFromEnv } from "@/lib/pastExams/fileSources";

// 考卷檔：開發讀 repo 內的 output/，線上讀私有 Blob（見 .env.development／.env.production）。
const source = examFileSourceFromEnv(process.env, { outputDir: join(process.cwd(), "output"), getBlob: get });

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await params;
  return handleExamFileRequest(request, path, { findExam: findAvailableExamByFile, source });
}
```

Run: `npx tsc --noEmit`
Expected: 沒有錯誤（`get` 可以指派給 `GetPrivateBlob`；若型別不合，只在 `blobExamFileSource` 的呼叫端調整轉接，不改 `GetPrivateBlob` 對 handler 的形狀）。

- [ ] **Step 8: 全部測試並 commit**

Run: `npm test`
Expected: 全部通過。

```bash
git add lib/pastExams/examFileHandler.ts lib/pastExams/examFileHandler.test.ts lib/pastExams/fileSources.ts "app/exams/[...path]/route.ts" package.json package-lock.json
git commit -m "feat(past-exams): serve exam files through /exams from output/ or private Blob

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 部署設定檢查（next.config）

**Files:**
- Create: `lib/pastExams/deployConfig.ts`、`lib/pastExams/deployConfig.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: 無
- Produces: `checkExamsDeployConfig(env: Readonly<Record<string, string | undefined>>): DeployConfigCheck`，`DeployConfigCheck = { error?: string; warning?: string }`

- [ ] **Step 1: 失敗測試**

`lib/pastExams/deployConfig.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { checkExamsDeployConfig } from "./deployConfig";

describe("checkExamsDeployConfig", () => {
  it("accepts Blob mode with a connected store", () => {
    expect(checkExamsDeployConfig({ VERCEL: "1", EXAMS_FILE_SOURCE: "blob", BLOB_STORE_ID: "store_x" })).toEqual({});
  });

  it("fails a Vercel build that would read files from output/", () => {
    expect(checkExamsDeployConfig({ VERCEL: "1", EXAMS_FILE_SOURCE: "local", BLOB_STORE_ID: "store_x" }).error).toMatch(
      /EXAMS_FILE_SOURCE/,
    );
  });

  it("fails a Vercel build without a connected Blob store", () => {
    expect(checkExamsDeployConfig({ VERCEL: "1", EXAMS_FILE_SOURCE: "blob" }).error).toMatch(/BLOB_STORE_ID/);
  });

  it("only warns on a local build", () => {
    const result = checkExamsDeployConfig({ EXAMS_FILE_SOURCE: "blob" });
    expect(result.error).toBeUndefined();
    expect(result.warning).toMatch(/BLOB_STORE_ID/);
  });
});
```

Run: `npx vitest run lib/pastExams/deployConfig.test.ts`
Expected: FAIL，找不到 `./deployConfig`。

- [ ] **Step 2: 實作**

`lib/pastExams/deployConfig.ts`：

```ts
export interface DeployConfigCheck {
  error?: string;
  warning?: string;
}

/** production build 前檢查考卷檔的來源：在 Vercel 上設定不對就讓 build 失敗，本機只警告。 */
export function checkExamsDeployConfig(env: Readonly<Record<string, string | undefined>>): DeployConfigCheck {
  let problem: string | null = null;
  if (env.EXAMS_FILE_SOURCE !== "blob") {
    problem = `EXAMS_FILE_SOURCE 是 ${JSON.stringify(env.EXAMS_FILE_SOURCE ?? "")}，線上必須是 "blob"（見 .env.production）。`;
  } else if (!env.BLOB_STORE_ID) {
    problem = "找不到 BLOB_STORE_ID：請在 Vercel 後台把私有 Blob store 連到這個專案（Production、Preview）。";
  }
  if (problem === null) return {};
  return env.VERCEL ? { error: problem } : { warning: problem };
}
```

Run: `npx vitest run lib/pastExams/deployConfig.test.ts`
Expected: PASS。

- [ ] **Step 3: 接到 `next.config.ts`**

先確認：`grep -n "(phase" node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/index.md`（設定可以是接收 `phase` 的函式）與 `grep -n "route globs" node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`（`outputFileTracingExcludes` 的 key 用 picomatch 比對路由路徑）。

`next.config.ts` 整個換成：

```ts
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { checkExamsDeployConfig } from "./lib/pastExams/deployConfig";

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const { error, warning } = checkExamsDeployConfig(process.env);
    if (error) throw new Error(error);
    if (warning) console.warn(`⚠ ${warning}`);
  }
  return {
    // 線上考卷檔從私有 Blob 讀：不要把本機 output/ 的檔案打包進 /exams 路由的函式。
    outputFileTracingExcludes: { "/exams/**": ["./output/**"] },
  };
}
```

- [ ] **Step 4: 驗證 build 的兩條路**

```bash
npm run build 2>&1 | tail -20
VERCEL=1 EXAMS_FILE_SOURCE=local npx next build 2>&1 | grep -m1 "EXAMS_FILE_SOURCE"
```

Expected: 第一個指令成功，沒有 `⚠` 警告（`.env.production` 是 blob、`.env.local` 有 `BLOB_STORE_ID`），路由表有 `ƒ /exams/[...path]`；第二個指令印出 `EXAMS_FILE_SOURCE 是 "local"，線上必須是 "blob"…` 並失敗。若 `next.config.ts` 無法 import `./lib/pastExams/deployConfig`（build 報模組錯誤），改成把 `checkExamsDeployConfig` 的內容直接寫在 `next.config.ts` 並 `export` 出來，測試改 import `../../next.config`。

- [ ] **Step 5: Commit**

```bash
git add lib/pastExams/deployConfig.ts lib/pastExams/deployConfig.test.ts next.config.ts
git commit -m "feat(past-exams): fail Vercel builds that are not wired to the private Blob store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: pdf.js 預覽器

**Files:**
- Create: `components/PastExams/pdfLayout.ts`、`components/PastExams/pdfLayout.test.ts`
- Create: `components/PastExams/pdfDocument.ts`
- Create: `components/PastExams/PdfViewer.tsx`、`components/PastExams/PdfViewer.test.tsx`
- Create: `testing/observers.ts`

**Interfaces:**
- Consumes: `pdfjs`、`pdfDocumentOptions`（`utils/pdfConfig.ts`，已存在）、`logger`（`utils/logger.ts`）
- Produces:
  - `Size = { width: number; height: number }`、`MIN_ZOOM = 0.5`、`MAX_ZOOM = 3`、`ZOOM_STEP = 0.25`
  - `pageDisplaySize(page: Size, containerWidth: number, zoom: number): Size`、`renderPixelRatio(devicePixelRatio: number | undefined): number`、`stepZoom(zoom: number, direction: 1 | -1): number`、`zoomLabel(zoom: number): string`
  - `interface LoadedPdf { pageSizes: Size[]; renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number, pixelRatio: number): RenderHandle; destroy(): void }`、`RenderHandle = { promise: Promise<void>; cancel(): void }`
  - `class PdfLoadError extends Error { status: number | null }`
  - `loadPdfDocument(url: string, signal: AbortSignal): Promise<LoadedPdf>`
  - `PdfViewer({ url, title }: { url: string; title: string })`（Task 7 使用）、`pdfErrorMessage(error: unknown): string`
  - `installObserverStubs(): void`、`resizeObservedElements(width: number): void`

- [ ] **Step 1: 版面純函式的失敗測試**

`components/PastExams/pdfLayout.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { pageDisplaySize, renderPixelRatio, stepZoom, zoomLabel } from "./pdfLayout";

describe("pageDisplaySize", () => {
  it("fits the page to the container width, keeping its aspect ratio", () => {
    expect(pageDisplaySize({ width: 595, height: 842 }, 400, 1)).toEqual({ width: 400, height: 566 });
  });

  it("scales with the zoom", () => {
    expect(pageDisplaySize({ width: 595, height: 842 }, 400, 1.5)).toEqual({ width: 600, height: 849 });
  });

  it("is empty while the container has no width", () => {
    expect(pageDisplaySize({ width: 595, height: 842 }, 0, 1)).toEqual({ width: 0, height: 0 });
  });
});

describe("renderPixelRatio", () => {
  it.each([
    [3, 2],
    [1.5, 1.5],
    [undefined, 1],
    [0.5, 1],
  ])("devicePixelRatio %s → %s", (ratio, expected) => {
    expect(renderPixelRatio(ratio)).toBe(expected);
  });
});

describe("stepZoom", () => {
  it.each([
    [1, 1, 1.25],
    [1, -1, 0.75],
    [3, 1, 3],
    [0.5, -1, 0.5],
  ] as const)("%s stepped %s → %s", (zoom, direction, expected) => {
    expect(stepZoom(zoom, direction)).toBe(expected);
  });
});

describe("zoomLabel", () => {
  it("shows a percentage", () => {
    expect(zoomLabel(1.25)).toBe("125%");
  });
});
```

Run: `npx vitest run components/PastExams/pdfLayout.test.ts`
Expected: FAIL，找不到 `./pdfLayout`。

- [ ] **Step 2: 實作 `pdfLayout.ts`**

```ts
export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;

/** 每頁的顯示尺寸：寬度 = 容器寬度 × 縮放，高度依頁面原始比例。 */
export function pageDisplaySize(page: Size, containerWidth: number, zoom: number): Size {
  const width = Math.max(0, Math.floor(containerWidth * zoom));
  return { width, height: page.width > 0 ? Math.round((width * page.height) / page.width) : 0 };
}

/** canvas 的像素密度：跟著螢幕，但最多 2 倍，免得高解析手機吃太多記憶體。 */
export function renderPixelRatio(devicePixelRatio: number | undefined): number {
  return Math.min(Math.max(devicePixelRatio || 1, 1), 2);
}

/** 上一級／下一級縮放，限制在 50%～300%。 */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const next = Math.round((zoom + direction * ZOOM_STEP) * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
```

Run: `npx vitest run components/PastExams/pdfLayout.test.ts`
Expected: PASS。

- [ ] **Step 3: pdf.js 包裝層**

`components/PastExams/pdfDocument.ts`（薄包裝，不做單元測試；Task 10 在瀏覽器驗證，Task 6 的元件測試會把它換成假的）：

```ts
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Size } from "./pdfLayout";

export interface RenderHandle {
  promise: Promise<void>;
  cancel(): void;
}

export interface LoadedPdf {
  /** 每頁原始尺寸（scale 1），順序同頁碼。 */
  pageSizes: Size[];
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number, pixelRatio: number): RenderHandle;
  destroy(): void;
}

/** 下載失敗；status 是 HTTP 狀態碼，網路錯誤時是 null。 */
export class PdfLoadError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "PdfLoadError";
    this.status = status;
  }
}

/** 自己用 fetch 抓整個檔案（可中斷），再交給 pdf.js；pdf.js 只在瀏覽器用到時才載入。 */
export async function loadPdfDocument(url: string, signal: AbortSignal): Promise<LoadedPdf> {
  let response: Response;
  try {
    response = await fetch(url, { signal, credentials: "same-origin" });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new PdfLoadError("無法下載 PDF", null);
  }
  if (!response.ok) throw new PdfLoadError(`下載 PDF 失敗（HTTP ${response.status}）`, response.status);
  const data = new Uint8Array(await response.arrayBuffer());

  const { pdfjs, pdfDocumentOptions } = await import("../../utils/pdfConfig");
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data, ...pdfDocumentOptions }).promise;
  if (signal.aborted) {
    void pdf.destroy();
    throw new DOMException("Aborted", "AbortError");
  }

  const pageSizes: Size[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const { width, height } = (await pdf.getPage(pageNumber)).getViewport({ scale: 1 });
    pageSizes.push({ width, height });
  }

  return {
    pageSizes,
    renderPage(pageNumber, canvas, cssWidth, pixelRatio) {
      let task: RenderTask | null = null;
      let cancelled = false;
      const promise = (async () => {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (cssWidth * pixelRatio) / base.width });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        task = page.render({ canvas, viewport, background: "rgb(255,255,255)" });
        await task.promise;
      })();
      return {
        promise,
        cancel() {
          cancelled = true;
          task?.cancel();
        },
      };
    },
    destroy() {
      void pdf.destroy();
    },
  };
}
```

Run: `npx tsc --noEmit`
Expected: 沒有錯誤。

- [ ] **Step 4: jsdom 的觀察器替身**

`testing/observers.ts`：

```ts
import { vi } from "vitest";

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;
interface ObservedResize {
  callback: ResizeCallback;
  targets: Set<Element>;
}

const resizeObservers = new Set<ObservedResize>();

/**
 * jsdom 沒有 ResizeObserver／IntersectionObserver：換成可控制的替身。
 * IntersectionObserver 一律回報「在畫面內」；ResizeObserver 由 resizeObservedElements 觸發。
 * 用 vi.unstubAllGlobals() 還原。
 */
export function installObserverStubs(): void {
  resizeObservers.clear();

  class ResizeObserverStub {
    private readonly observed: ObservedResize;

    constructor(callback: ResizeCallback) {
      this.observed = { callback, targets: new Set() };
      resizeObservers.add(this.observed);
    }

    observe(target: Element) {
      this.observed.targets.add(target);
    }

    unobserve(target: Element) {
      this.observed.targets.delete(target);
    }

    disconnect() {
      resizeObservers.delete(this.observed);
    }
  }

  class IntersectionObserverStub {
    private readonly callback: (entries: { isIntersecting: boolean; target: Element }[]) => void;

    constructor(callback: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{ isIntersecting: true, target }]);
    }

    unobserve() {}

    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
}

/** 模擬每個被觀察的元素內容寬度變成 width。 */
export function resizeObservedElements(width: number): void {
  for (const { callback, targets } of resizeObservers) {
    if (targets.size > 0) callback([...targets].map(() => ({ contentRect: { width } })));
  }
}
```

- [ ] **Step 5: 預覽器的失敗測試**

`components/PastExams/PdfViewer.test.tsx`：

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installObserverStubs, resizeObservedElements } from "../../testing/observers";
import type { LoadedPdf } from "./pdfDocument";

const mocks = vi.hoisted(() => ({
  loads: [] as {
    url: string;
    signal: AbortSignal;
    resolve: (pdf: LoadedPdf) => void;
    reject: (error: unknown) => void;
  }[],
}));

vi.mock("./pdfDocument", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./pdfDocument")>()),
  loadPdfDocument: (url: string, signal: AbortSignal) =>
    new Promise<LoadedPdf>((resolve, reject) => {
      mocks.loads.push({ url, signal, resolve, reject });
    }),
}));

import { PdfLoadError } from "./pdfDocument";
import { PdfViewer } from "./PdfViewer";

let container: HTMLDivElement;
let root: Root;

function fakePdf(pages: number) {
  return {
    pageSizes: Array.from({ length: pages }, () => ({ width: 600, height: 800 })),
    renderPage: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    destroy: vi.fn(),
  } satisfies LoadedPdf;
}

function render(url: string) {
  act(() => root.render(<PdfViewer url={url} title="考卷" />));
}

async function resolveLoad(index: number, pdf: LoadedPdf) {
  await act(async () => {
    mocks.loads[index].resolve(pdf);
  });
}

async function rejectLoad(index: number, error: unknown) {
  await act(async () => {
    mocks.loads[index].reject(error);
  });
}

function setWidth(width: number) {
  act(() => {
    resizeObservedElements(width);
    vi.advanceTimersByTime(150);
  });
}

function canvases(): HTMLCanvasElement[] {
  return [...container.querySelectorAll("canvas")];
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent?.trim() === name,
  );
  if (!found) throw new Error(`button not found: ${name}`);
  return found;
}

function fitButton(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('[title="適合寬度"]')!;
}

beforeEach(() => {
  vi.useFakeTimers();
  installObserverStubs();
  mocks.loads.length = 0;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PdfViewer", () => {
  it("shows a spinner, then renders every page at the container width", async () => {
    render("/exams/a.pdf");
    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
    expect(mocks.loads[0].url).toBe("/exams/a.pdf");

    const pdf = fakePdf(2);
    await resolveLoad(0, pdf);
    setWidth(600);

    expect(canvases().map((canvas) => canvas.getAttribute("aria-label"))).toEqual(["第 1 頁", "第 2 頁"]);
    expect(canvases()[0].style.width).toBe("600px");
    expect(canvases()[0].style.height).toBe("800px");
    expect(pdf.renderPage).toHaveBeenCalledWith(1, canvases()[0], 600, 1);
    expect(pdf.renderPage).toHaveBeenCalledWith(2, canvases()[1], 600, 1);
  });

  it("does not render while the viewer has no width", async () => {
    render("/exams/a.pdf");
    const pdf = fakePdf(2);
    await resolveLoad(0, pdf);

    expect(canvases()).toHaveLength(2);
    expect(pdf.renderPage).not.toHaveBeenCalled();
  });

  it.each([
    [new PdfLoadError("x", 404), "找不到這份考卷的檔案（可能還沒上傳）"],
    [new PdfLoadError("x", 403), "請從考古題頁面開啟這份考卷"],
    [new PdfLoadError("x", null), "PDF 載入失敗"],
    [new Error("bad pdf"), "PDF 載入失敗"],
  ])("explains a failed load (%s) and offers retry and a new tab", async (error, message) => {
    render("/exams/a.pdf");
    await rejectLoad(0, error);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(message);
    const open = [...container.querySelectorAll("a")].find((link) => link.textContent?.trim() === "在新分頁開啟");
    expect(open?.getAttribute("href")).toBe("/exams/a.pdf");

    act(() => button("重試").click());
    expect(mocks.loads).toHaveLength(2);
    expect(mocks.loads[1].url).toBe("/exams/a.pdf");
    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
  });

  it("drops a slow download when the exam changes", async () => {
    render("/exams/a.pdf");
    render("/exams/b.pdf");
    expect(mocks.loads[0].signal.aborted).toBe(true);

    const b = fakePdf(3);
    await resolveLoad(1, b);
    const a = fakePdf(1);
    await resolveLoad(0, a);

    expect(a.destroy).toHaveBeenCalled();
    expect(canvases()).toHaveLength(3);
  });

  it("releases the previous document when the exam changes", async () => {
    render("/exams/a.pdf");
    const a = fakePdf(2);
    await resolveLoad(0, a);

    render("/exams/b.pdf");

    expect(a.destroy).toHaveBeenCalled();
    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
  });

  it("zooms in steps and back to fit width", async () => {
    render("/exams/a.pdf");
    const pdf = fakePdf(1);
    await resolveLoad(0, pdf);
    setWidth(600);

    act(() => button("放大").click());
    expect(fitButton().textContent).toBe("125%");
    expect(canvases()[0].style.width).toBe("750px");
    expect(pdf.renderPage).toHaveBeenLastCalledWith(1, canvases()[0], 750, 1);

    act(() => fitButton().click());
    expect(canvases()[0].style.width).toBe("600px");

    act(() => button("縮小").click());
    act(() => button("縮小").click());
    expect(fitButton().textContent).toBe("50%");
    expect(button("縮小").disabled).toBe(true);
  });
});
```

Run: `npx vitest run components/PastExams/PdfViewer.test.tsx`
Expected: FAIL，找不到 `./PdfViewer`。

- [ ] **Step 6: 實作 `PdfViewer.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, RotateCw } from "lucide-react";
import { logger } from "../../utils/logger";
import { loadPdfDocument, PdfLoadError, type LoadedPdf } from "./pdfDocument";
import { MAX_ZOOM, MIN_ZOOM, pageDisplaySize, renderPixelRatio, stepZoom, zoomLabel, type Size } from "./pdfLayout";

const RESIZE_DEBOUNCE_MS = 150;

type LoadResult = { url: string; attempt: number } & (
  | { pdf: LoadedPdf; error: null }
  | { pdf: null; error: string }
);

/** 把下載或解析錯誤轉成給使用者看的訊息。 */
export function pdfErrorMessage(error: unknown): string {
  if (error instanceof PdfLoadError && error.status === 404) return "找不到這份考卷的檔案（可能還沒上傳）";
  if (error instanceof PdfLoadError && error.status === 403) return "請從考古題頁面開啟這份考卷";
  return "PDF 載入失敗";
}

/**
 * 用 pdf.js 把考卷畫在 canvas 上：所有頁由上而下，快捲進畫面才畫，可縮放。
 * 換網址時中斷上一份的下載並釋放文件；縮放倍率跨考卷保留。
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let pdf: LoadedPdf | null = null;
    loadPdfDocument(url, controller.signal).then(
      (loaded) => {
        if (controller.signal.aborted) {
          loaded.destroy();
          return;
        }
        pdf = loaded;
        setResult({ url, attempt, pdf: loaded, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        logger.warn("[PdfViewer] load failed", error);
        setResult({ url, attempt, pdf: null, error: pdfErrorMessage(error) });
      },
    );
    return () => {
      controller.abort();
      pdf?.destroy();
    };
  }, [url, attempt]);

  // 換考卷時捲回頂端。
  useEffect(() => {
    scroller?.scrollTo?.({ top: 0, left: 0 });
  }, [url, scroller]);

  // 內容區寬度（不含 padding）；拖拉視窗時等一下才重畫。
  useEffect(() => {
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      clearTimeout(timer);
      timer = setTimeout(() => setContainerWidth(width), RESIZE_DEBOUNCE_MS);
    });
    observer.observe(scroller);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [scroller]);

  const current = result && result.url === url && result.attempt === attempt ? result : null;

  return (
    <div className="relative h-full">
      <div ref={setScroller} role="document" aria-label={title} className="h-full overflow-auto p-3">
        {current === null ? (
          <div className="flex h-full items-center justify-center">
            <span className="loading loading-spinner loading-lg" aria-label="載入 PDF" />
          </div>
        ) : current.error !== null ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-base-content/70">{current.error}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-sm" onClick={() => setAttempt((value) => value + 1)}>
                <RotateCw className="size-4" aria-hidden="true" />
                重試
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                <ExternalLink className="size-4" aria-hidden="true" />
                在新分頁開啟
              </a>
            </div>
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-3">
            {current.pdf.pageSizes.map((size, index) => (
              <PdfPage
                key={index}
                pdf={current.pdf}
                pageNumber={index + 1}
                root={scroller}
                display={pageDisplaySize(size, containerWidth, zoom)}
              />
            ))}
          </div>
        )}
      </div>
      {current?.pdf && (
        <div className="join absolute right-3 bottom-3 shadow-md">
          <button
            type="button"
            className="btn join-item btn-sm"
            aria-label="縮小"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => stepZoom(value, -1))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn join-item btn-sm min-w-16"
            title="適合寬度"
            aria-label={`適合寬度（目前 ${zoomLabel(zoom)}）`}
            onClick={() => setZoom(1)}
          >
            {zoomLabel(zoom)}
          </button>
          <button
            type="button"
            className="btn join-item btn-sm"
            aria-label="放大"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => stepZoom(value, 1))}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

interface PdfPageProps {
  pdf: LoadedPdf;
  pageNumber: number;
  display: Size;
  root: Element | null;
}

function PdfPage({ pdf, pageNumber, display, root }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  // 快捲進畫面（前後一個畫面高）才畫；畫過就一直保留。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { root, rootMargin: "100% 0px" },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [root, visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || display.width === 0) return;
    const handle = pdf.renderPage(pageNumber, canvas, display.width, renderPixelRatio(window.devicePixelRatio));
    handle.promise.catch((error: unknown) => {
      if (!(error instanceof Error && error.name === "RenderingCancelledException")) {
        logger.warn("[PdfViewer] render failed", error);
      }
    });
    return () => handle.cancel();
  }, [pdf, pageNumber, visible, display.width]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`第 ${pageNumber} 頁`}
      className="block bg-white shadow-sm"
      style={{ width: display.width, height: display.height }}
    />
  );
}
```

- [ ] **Step 7: 執行，確認通過，再跑 lint**

Run: `npx vitest run components/PastExams/PdfViewer.test.tsx components/PastExams/pdfLayout.test.ts`
Expected: PASS。

Run: `npx eslint components/PastExams testing`
Expected: 沒有錯誤（特別是 `react-hooks/set-state-in-effect`、`react-hooks/refs`）。

- [ ] **Step 8: Commit**

```bash
git add components/PastExams/pdfLayout.ts components/PastExams/pdfLayout.test.ts components/PastExams/pdfDocument.ts components/PastExams/PdfViewer.tsx components/PastExams/PdfViewer.test.tsx testing/observers.ts
git commit -m "feat(past-exams): pdf.js viewer with lazy page rendering and zoom

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 預覽區改用 pdf.js（移除 iframe）

**Files:**
- Modify: `components/PastExams/ExamPreview.tsx`
- Modify: `components/PastExams/viewport.ts`
- Modify: `components/PastExams/PastExamsPage.test.tsx`

**Interfaces:**
- Consumes: `PdfViewer`（Task 6）、`examFileUrl(file, { download })`、`downloadFileName`（Task 3）
- Produces: 無新介面；`viewport.ts` 只剩 `isDesktop()`

- [ ] **Step 1: 改頁面測試（失敗測試）**

在 `components/PastExams/PastExamsPage.test.tsx`：

1. 在 `import PastExamsPage from "./PastExamsPage";` 上方加：

```tsx
vi.mock("./PdfViewer", () => ({
  PdfViewer: ({ url, title }: { url: string; title: string }) => <div data-pdf-viewer={url} aria-label={title} />,
}));
```

2. 在 `row()` 函式後面加：

```tsx
function viewer(): Element | null {
  return container.querySelector("[data-pdf-viewer]");
}
```

3. 把檔案裡每一個 `container.querySelector("iframe")` 換成 `viewer()`。
4. 「previews a PDF when its row is clicked」最後兩行換成：

```tsx
    expect(viewer()?.getAttribute("data-pdf-viewer")).toBe(`/exams/${minquan.file}`);
```

5. 「offers a download instead of a preview for Word files」的 href 期望值換成：

```tsx
    expect(download?.getAttribute("href")).toBe(`/exams/${datong.file}?download=1`);
```

6. `describe("on a phone")` 裡的「opens PDFs in a new tab instead of embedding them」整個測試換成：

```tsx
    it("shows the PDF viewer on phones too", () => {
      renderPage();

      act(() => row("民權國小").click());

      expect(viewer()?.getAttribute("data-pdf-viewer")).toBe(`/exams/${minquan.file}`);
    });
```

Run: `npx vitest run components/PastExams/PastExamsPage.test.tsx`
Expected: FAIL——預覽還是 iframe（`viewer()` 是 null）、Word 下載連結沒有 `?download=1`。

- [ ] **Step 2: 改 `ExamPreview.tsx`**

整個換成：

```tsx
"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from "lucide-react";
import { downloadFileName } from "../../lib/pastExams/fileResponse";
import { examFileUrl } from "../../lib/pastExams/fileUrl";
import { UNKNOWN } from "../../lib/pastExams/filters";
import type { PastExam } from "../../lib/pastExams/types";
import { PdfViewer } from "./PdfViewer";

interface ExamPreviewProps {
  exam: PastExam | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

/** PDF 用 pdf.js 畫在頁面上（桌機、手機相同）；Word 只能下載。 */
export function ExamPreview({ exam, hasPrevious, hasNext, onPrevious, onNext, onClose }: ExamPreviewProps) {
  if (!exam) {
    return (
      <div className="surface-card flex h-full flex-col items-center justify-center gap-3 rounded-xl p-6 text-center text-sm text-base-content/60">
        <FileText className="size-10 opacity-40" strokeWidth={1.5} aria-hidden="true" />
        <p>點左邊的考卷開始瀏覽，可用 ← → 切換</p>
      </div>
    );
  }

  const url = examFileUrl(exam.file);
  const downloadUrl = examFileUrl(exam.file, { download: true });
  const iconButton = "btn btn-ghost btn-sm btn-square";

  return (
    <div className="surface-card flex h-full flex-col overflow-hidden md:rounded-xl">
      <header className="flex items-center gap-2 border-b border-border-hairline px-2 py-2 sm:px-3">
        <button type="button" className={`${iconButton} md:hidden`} aria-label="關閉預覽" onClick={onClose}>
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            {exam.school ?? UNKNOWN}
            <span className="ml-2 text-sm font-normal text-base-content/60">{exam.city ?? UNKNOWN}</span>
          </h2>
          <p className="truncate text-xs text-base-content/60">
            {exam.academicYearLabel} {exam.periodLabel}
            {exam.pages !== null && ` · ${exam.pages} 頁`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className={iconButton} aria-label="上一份" title="上一份（←）" disabled={!hasPrevious} onClick={onPrevious}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={iconButton} aria-label="下一份" title="下一份（→）" disabled={!hasNext} onClick={onNext}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          {exam.format === "pdf" && (
            <a href={url} target="_blank" rel="noopener noreferrer" className={iconButton} aria-label="在新分頁開啟" title="在新分頁開啟">
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
          <a href={downloadUrl} download={downloadFileName(exam)} className="btn btn-sm" title="下載">
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">下載</span>
          </a>
        </div>
      </header>
      <div className="min-h-0 flex-1 bg-base-200">
        {exam.format === "pdf" ? (
          <PdfViewer url={url} title={exam.title} />
        ) : (
          <FileNotice message="Word 檔無法在頁面內預覽，請下載後開啟。">
            <a href={downloadUrl} download={downloadFileName(exam)} className="btn btn-primary btn-sm">
              <Download className="size-4" aria-hidden="true" />
              下載 Word 檔
            </a>
          </FileNotice>
        )}
      </div>
    </div>
  );
}

function FileNotice({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <FileText className="size-12 text-base-content/40" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-sm text-base-content/70">{message}</p>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `viewport.ts` 只留 `isDesktop`**

整個換成：

```ts
/** 與 Tailwind 的 md 斷點一致：桌機是左右分割，手機是全螢幕預覽層。 */
const DESKTOP_QUERY = "(min-width: 48rem)";

export function isDesktop(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia(DESKTOP_QUERY).matches;
}
```

- [ ] **Step 4: 執行，確認通過；全部測試與型別**

Run: `npx vitest run components/PastExams/PastExamsPage.test.tsx`
Expected: PASS。

Run: `npm test && npx tsc --noEmit && npx eslint`
Expected: 全部通過；`grep -rn "useIsDesktop\|iframe" components` 沒有結果。

- [ ] **Step 5: Commit**

```bash
git add components/PastExams/ExamPreview.tsx components/PastExams/viewport.ts components/PastExams/PastExamsPage.test.tsx
git commit -m "feat(past-exams): preview PDFs with pdf.js on every screen size

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 上傳到私有 Blob

**Files:**
- Create: `scripts/uploadExams.ts`、`scripts/uploadExams.test.ts`、`scripts/upload-exams.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `readOutputCatalog`（Task 2）、`contentTypeFor`（Task 3）、`BLOB_PREFIX`（Task 4）、`writeFakeOutput`（Task 2）
- Produces:
  - `RemoteBlob = { pathname: string; size: number; url: string }`
  - `interface BlobClient { listAll(prefix: string): Promise<{ blobs: RemoteBlob[]; requests: number }>; put(pathname: string, body: Buffer, contentType: string): Promise<void>; del(urls: string[]): Promise<void> }`
  - `UploadPlan = { upload: string[]; skip: string[]; stale: RemoteBlob[] }`、`planUpload(local: ReadonlyMap<string, number>, remote: readonly RemoteBlob[]): UploadPlan`
  - `ListPage = (cursor: string | undefined) => Promise<{ blobs: RemoteBlob[]; cursor?: string; hasMore: boolean }>`、`listAllBlobs(listPage: ListPage): Promise<{ blobs: RemoteBlob[]; requests: number }>`
  - `hasBlobCredentials(env): boolean`、`CREDENTIALS_HINT: string`、`OPERATIONS_WARNING_THRESHOLD = 1500`、`class UploadError extends Error`
  - `uploadExams(options: { outputDir: string; client: BlobClient; dryRun?: boolean; prune?: boolean; log?: (line: string) => void }): Promise<UploadSummary>`，`UploadSummary = { planned: UploadPlan; uploaded: number; failed: string[]; deleted: number; operations: number }`

- [ ] **Step 1: 失敗測試**

`scripts/uploadExams.test.ts`：

```ts
// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFakeOutput } from "../testing/fakeExamOutput";
import { hasBlobCredentials, listAllBlobs, uploadExams, type BlobClient, type RemoteBlob } from "./uploadExams";

let root: string;
let outputDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "upload-exams-"));
  outputDir = join(root, "output");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function blob(pathname: string, size: number): RemoteBlob {
  return { pathname, size, url: `https://store.private.blob.vercel-storage.com/${pathname}` };
}

function fakeClient(remote: RemoteBlob[] = [], requests = 1) {
  const puts: { pathname: string; body: string; contentType: string }[] = [];
  const deleted: string[][] = [];
  const client: BlobClient = {
    listAll: vi.fn(async () => ({ blobs: remote, requests })),
    put: vi.fn(async (pathname: string, body: Buffer, contentType: string) => {
      puts.push({ pathname, body: body.toString(), contentType });
    }),
    del: vi.fn(async (urls: string[]) => {
      deleted.push(urls);
    }),
  };
  return { client, puts, deleted };
}

const quiet = () => {};

describe("uploadExams", () => {
  beforeEach(async () => {
    await writeFakeOutput(outputDir, [
      { id: "a", path: "pdf/ds/a.pdf", content: "aaaa" },
      { id: "b", path: "pdf/ds/b.pdf", content: "bbbb" },
      { id: "c", path: "doc/ds/c.docx", content: "cc" },
      { id: "d", path: "pdf/ds/d.pdf", downloaded: false },
    ]);
  });

  it("uploads missing and changed files and skips unchanged ones", async () => {
    const { client, puts, deleted } = fakeClient([
      blob("exams/pdf/ds/a.pdf", 4),
      blob("exams/pdf/ds/b.pdf", 99),
      blob("exams/pdf/ds/old.pdf", 1),
    ]);

    const summary = await uploadExams({ outputDir, client, log: quiet });

    expect(summary.planned.skip).toEqual(["pdf/ds/a.pdf"]);
    expect(puts.sort((x, y) => x.pathname.localeCompare(y.pathname))).toEqual([
      {
        pathname: "exams/doc/ds/c.docx",
        body: "cc",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      { pathname: "exams/pdf/ds/b.pdf", body: "bbbb", contentType: "application/pdf" },
    ]);
    expect(summary.planned.stale.map((item) => item.pathname)).toEqual(["exams/pdf/ds/old.pdf"]);
    expect(summary.uploaded).toBe(2);
    expect(deleted).toEqual([]);
  });

  it("changes nothing on --dry-run", async () => {
    const { client, puts } = fakeClient();

    const summary = await uploadExams({ outputDir, client, dryRun: true, log: quiet });

    expect(puts).toEqual([]);
    expect(summary.planned.upload).toHaveLength(3);
    expect(summary.operations).toBe(4);
  });

  it("deletes stale blobs only with --prune", async () => {
    const { client, deleted } = fakeClient([blob("exams/pdf/ds/old.pdf", 1)]);

    const summary = await uploadExams({ outputDir, client, prune: true, log: quiet });

    expect(deleted).toEqual([["https://store.private.blob.vercel-storage.com/exams/pdf/ds/old.pdf"]]);
    expect(summary.deleted).toBe(1);
  });

  it("uploads nothing when a local file does not match the catalog size", async () => {
    await writeFakeOutput(outputDir, [
      { id: "a", path: "pdf/ds/a.pdf", content: "aaaa" },
      { id: "b", path: "pdf/ds/b.pdf", content: "bbbb", bytes: 999 },
    ]);
    const { client, puts } = fakeClient();

    await expect(uploadExams({ outputDir, client, log: quiet })).rejects.toThrow(/pdf\/ds\/b\.pdf.*999/);
    expect(client.listAll).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("uploads nothing when a downloaded file is missing locally", async () => {
    await rm(join(outputDir, "pdf", "ds", "a.pdf"));
    const { client, puts } = fakeClient();

    await expect(uploadExams({ outputDir, client, log: quiet })).rejects.toThrow(/pdf\/ds\/a\.pdf/);
    expect(puts).toEqual([]);
  });

  it("explains how to refresh credentials when the store cannot be read", async () => {
    const { client } = fakeClient();
    vi.mocked(client.listAll).mockRejectedValueOnce(new Error("Access denied, please provide a valid token"));

    await expect(uploadExams({ outputDir, client, log: quiet })).rejects.toThrow(/vercel env pull/);
  });

  it("warns when the run would use most of the monthly operations", async () => {
    const { client } = fakeClient([], 1500);
    const lines: string[] = [];

    await uploadExams({ outputDir, client, dryRun: true, log: (line) => lines.push(line) });

    expect(lines.some((line) => line.startsWith("⚠"))).toBe(true);
  });

  it("reports a failed upload without stopping the others", async () => {
    const { client } = fakeClient();
    vi.mocked(client.put).mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const summary = await uploadExams({ outputDir, client, log: quiet });

    expect(summary.failed).toHaveLength(1);
    expect(summary.uploaded).toBe(2);
  });
});

describe("listAllBlobs", () => {
  it("follows cursors until the last page", async () => {
    const pages = {
      first: { blobs: [blob("exams/a", 1)], cursor: "c1", hasMore: true },
      c1: { blobs: [blob("exams/b", 1)], cursor: "c2", hasMore: true },
      c2: { blobs: [blob("exams/c", 1)], hasMore: false },
    };
    const listPage = vi.fn(async (cursor: string | undefined) => pages[(cursor ?? "first") as keyof typeof pages]);

    const result = await listAllBlobs(listPage);

    expect(result.blobs.map((item) => item.pathname)).toEqual(["exams/a", "exams/b", "exams/c"]);
    expect(result.requests).toBe(3);
    expect(listPage.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, "c1", "c2"]);
  });
});

describe("hasBlobCredentials", () => {
  it.each([
    [{ VERCEL_OIDC_TOKEN: "t", BLOB_STORE_ID: "s" }, true],
    [{ BLOB_READ_WRITE_TOKEN: "rw" }, true],
    [{ VERCEL_OIDC_TOKEN: "t" }, false],
    [{}, false],
  ])("%o → %s", (env, expected) => {
    expect(hasBlobCredentials(env)).toBe(expected);
  });
});
```

Run: `npx vitest run scripts/uploadExams.test.ts`
Expected: FAIL，找不到 `./uploadExams`。

- [ ] **Step 2: 實作 `scripts/uploadExams.ts`**

```ts
// 把 output/ 裡已下載的考卷上傳到私有 Vercel Blob 的 exams/<relative_path>。
// Node 直接跑 TS，所以相對 import 要寫 .ts 副檔名。
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { contentTypeFor } from "../lib/pastExams/fileResponse.ts";
import { BLOB_PREFIX } from "../lib/pastExams/fileSources.ts";
import { readOutputCatalog } from "./examCatalog.ts";

export const OPERATIONS_WARNING_THRESHOLD = 1500;
const CONCURRENCY = 4;

export const CREDENTIALS_HINT =
  "找不到或無法使用 Blob 憑證：請執行 npx vercel link 與 npx vercel env pull .env.local（OIDC 憑證過期時也要重新執行 env pull）。";

export interface RemoteBlob {
  pathname: string;
  size: number;
  url: string;
}

export interface BlobClient {
  /** 列出 prefix 底下所有檔案（自己處理分頁）；requests 是呼叫 list 的次數。 */
  listAll(prefix: string): Promise<{ blobs: RemoteBlob[]; requests: number }>;
  put(pathname: string, body: Buffer, contentType: string): Promise<void>;
  del(urls: string[]): Promise<void>;
}

export interface UploadPlan {
  upload: string[];
  skip: string[];
  stale: RemoteBlob[];
}

export interface UploadSummary {
  planned: UploadPlan;
  uploaded: number;
  failed: string[];
  deleted: number;
  operations: number;
}

export class UploadError extends Error {
  name = "UploadError";
}

export type ListPage = (cursor: string | undefined) => Promise<{ blobs: RemoteBlob[]; cursor?: string; hasMore: boolean }>;

/** 跟著 cursor 翻頁直到最後一頁。 */
export async function listAllBlobs(listPage: ListPage): Promise<{ blobs: RemoteBlob[]; requests: number }> {
  const blobs: RemoteBlob[] = [];
  let cursor: string | undefined;
  let requests = 0;
  do {
    const page = await listPage(cursor);
    requests += 1;
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { blobs, requests };
}

export function hasBlobCredentials(env: Readonly<Record<string, string | undefined>>): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN || (env.VERCEL_OIDC_TOKEN && env.BLOB_STORE_ID));
}

/** 遠端沒有或大小不同 → 上傳；大小相同 → 跳過；遠端有但 catalog 沒有 → 多出來。 */
export function planUpload(local: ReadonlyMap<string, number>, remote: readonly RemoteBlob[]): UploadPlan {
  const remoteSizes = new Map(remote.map((item) => [item.pathname, item.size]));
  const upload: string[] = [];
  const skip: string[] = [];
  for (const [file, size] of local) {
    (remoteSizes.get(`${BLOB_PREFIX}${file}`) === size ? skip : upload).push(file);
  }
  const stale = remote.filter((item) => !local.has(item.pathname.slice(BLOB_PREFIX.length)));
  return { upload, skip, stale };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fileSize(path: string): Promise<number | null> {
  try {
    const info = await stat(path);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

async function runWithConcurrency<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

export async function uploadExams({
  outputDir,
  client,
  dryRun = false,
  prune = false,
  log = console.log,
}: {
  outputDir: string;
  client: BlobClient;
  dryRun?: boolean;
  prune?: boolean;
  log?: (line: string) => void;
}): Promise<UploadSummary> {
  // 先驗證 catalog 與本機檔案；任何一份不完整就一個都不傳。
  const catalog = await readOutputCatalog(outputDir);
  const local = new Map<string, number>();
  const problems: string[] = [];
  for (const exam of catalog.exams) {
    if (!exam.available) continue;
    const size = await fileSize(join(outputDir, ...exam.file.split("/")));
    if (size === null) problems.push(`${exam.file}：本機沒有這個檔案`);
    else if (exam.bytes !== null && size !== exam.bytes) problems.push(`${exam.file}：大小 ${size} 與 catalog 的 ${exam.bytes} 不符`);
    else local.set(exam.file, size);
  }
  if (problems.length > 0) {
    throw new UploadError(`有 ${problems.length} 份考卷檔不完整，沒有上傳任何檔案：\n${problems.join("\n")}`);
  }

  let listed: { blobs: RemoteBlob[]; requests: number };
  try {
    listed = await client.listAll(BLOB_PREFIX);
  } catch (error) {
    throw new UploadError(`無法讀取 Blob store：${errorText(error)}\n${CREDENTIALS_HINT}`);
  }

  const planned = planUpload(local, listed.blobs);
  const operations = listed.requests + planned.upload.length;
  log(`要上傳 ${planned.upload.length} 份、跳過 ${planned.skip.length} 份、Blob 上多出 ${planned.stale.length} 份；預估進階操作 ${operations} 次。`);
  if (operations > OPERATIONS_WARNING_THRESHOLD) {
    log(`⚠ 預估超過 ${OPERATIONS_WARNING_THRESHOLD} 次：免費方案每月只有 2,000 次進階操作（在後台瀏覽 store 也算）。`);
  }
  if (dryRun) return { planned, uploaded: 0, failed: [], deleted: 0, operations };

  const failed: string[] = [];
  let uploaded = 0;
  await runWithConcurrency(planned.upload, CONCURRENCY, async (file) => {
    try {
      const body = await readFile(join(outputDir, ...file.split("/")));
      await client.put(`${BLOB_PREFIX}${file}`, body, contentTypeFor(file));
      uploaded += 1;
    } catch (error) {
      failed.push(file);
      log(`上傳失敗 ${file}：${errorText(error)}`);
    }
  });

  let deleted = 0;
  if (prune && planned.stale.length > 0) {
    await client.del(planned.stale.map((item) => item.url));
    deleted = planned.stale.length;
  }
  return { planned, uploaded, failed, deleted, operations };
}
```

Run: `npx vitest run scripts/uploadExams.test.ts`
Expected: PASS。

- [ ] **Step 3: CLI 與 npm script**

`scripts/upload-exams.ts`：

```ts
// 用法：npm run upload:exams [-- --dry-run] [-- --prune]
// 把 output/ 已下載的考卷傳到私有 Vercel Blob；憑證來自 .env.local（npx vercel env pull .env.local）。
import { join, resolve } from "node:path";
import { del, list, put } from "@vercel/blob";
import { CREDENTIALS_HINT, hasBlobCredentials, listAllBlobs, uploadExams, type BlobClient } from "./uploadExams.ts";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const prune = args.has("--prune");

if (!hasBlobCredentials(process.env)) {
  console.error(CREDENTIALS_HINT);
  process.exit(1);
}

const client: BlobClient = {
  listAll: (prefix) => listAllBlobs((cursor) => list({ prefix, cursor, limit: 1000 })),
  async put(pathname, body, contentType) {
    await put(pathname, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
  },
  del: (urls) => del(urls),
};

const repoRoot = resolve(import.meta.dirname, "..");
try {
  const summary = await uploadExams({ outputDir: join(repoRoot, "output"), client, dryRun, prune });
  if (dryRun) {
    console.log("（--dry-run：沒有上傳或刪除任何檔案）");
  } else {
    console.log(
      `完成：上傳 ${summary.uploaded}、跳過 ${summary.planned.skip.length}、失敗 ${summary.failed.length}、刪除 ${summary.deleted}。`,
    );
    if (!prune && summary.planned.stale.length > 0) {
      console.log(`Blob 上有 ${summary.planned.stale.length} 份已不在 catalog 裡；新版部署上線後可用 --prune 刪除。`);
    }
    console.log("上傳完成後再 git push，線上才不會出現打不開的考卷。");
  }
  if (summary.failed.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
```

`package.json` 的 `scripts` 加：

```json
    "upload:exams": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts/upload-exams.ts",
```

Run: `npx tsc --noEmit && npm run upload:exams -- --dry-run`
Expected: 型別沒有錯誤；dry-run 印出「要上傳 192 份、跳過 0 份、Blob 上多出 0 份；預估進階操作 193 次。」與「（--dry-run：沒有上傳或刪除任何檔案）」（store 目前是空的；只呼叫一次 list）。

- [ ] **Step 4: 全部測試並 commit**

Run: `npm test`
Expected: 全部通過。

```bash
git add scripts/uploadExams.ts scripts/uploadExams.test.ts scripts/upload-exams.ts package.json
git commit -m "feat(past-exams): upload exam files from output/ to the private Blob store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: README 與全面檢查

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1–8 的指令與設定
- Produces: 無

- [ ] **Step 1: 改 README**

把「程式結構」最後一行換成：

```markdown
- `components/PastExams/`、`lib/pastExams/`：考古題頁面、pdf.js 預覽器與純函式（篩選、排序、網址狀態、檔案存取）；`app/exams/[...path]/route.ts` 提供考卷檔；`scripts/` 是產生目錄與上傳的腳本。
```

把 `## 考古題` 整節（到檔案結尾）換成：

````markdown
## 考古題

`/past-exams` 用來瀏覽 cowork 整理好的考古題。cowork 直接把資料寫進這個 repo 的 `output/`；分類、驗證、搜尋正規化都以 cowork 的 `catalog-info.json` 與 `catalog.jsonl` 為準（格式見 `output/metadata-format.md`）。這邊只讀 `output/`，不修改它。

### 資料

- `output/` 只有 meta（`*.json`、`*.jsonl`、`*.md`）進 git；PDF、Word 等考卷檔只在本機（見 `.gitignore`）。
- `npm run dev`／`npm run build` 前會自動執行 `npm run catalog`，從 `output/` 產生 `data/pastExams.json`（不進 git）。catalog 有問題（`schema_version` 不是 1、`record_count` 不符、`record_id` 重複、JSON 壞掉、`relative_path` 跳出根目錄）就失敗，dev／build 跟著停。
- 剛 clone 下來先跑一次 `npm run catalog`，型別檢查才找得到 `data/pastExams.json`。

### 考卷檔怎麼送到瀏覽器

所有考卷檔都經過本站的 `/exams/<relative_path>`：

- 只提供 catalog 裡已下載的考卷。
- 只接受本站頁面發出的請求（`Sec-Fetch-Site: same-origin`，較舊的瀏覽器看 `Referer`）；直接輸入網址、貼到聊天軟體、其他網站的連結或嵌入都會得到 403。
- 來源由 `EXAMS_FILE_SOURCE` 決定：`.env.development` 是 `local`（讀 `output/`），`.env.production` 是 `blob`（讀私有 Vercel Blob 的 `exams/<relative_path>`）。
- 預覽用 pdf.js 畫在頁面上；Word 只能下載。

### 上線（Vercel＋私有 Blob）

一次性設定：

1. 在 Vercel 建一個 **Private** 的 Blob store，連到專案的 Production、Preview、Development（使用 OIDC，不用加 read-write token）。
2. 本機執行 `npx vercel link` 與 `npx vercel env pull .env.local`（`.env.local` 不進 git；OIDC 憑證過期時重新執行 env pull）。
3. Node 版本由 `package.json` 的 `engines`（24.x）決定。在 Vercel 上 build 時，如果 `EXAMS_FILE_SOURCE` 不是 `blob` 或 store 沒有連到專案，build 會失敗。

新增或更新考卷：

```sh
npm run upload:exams -- --dry-run   # 先看會上傳哪些檔案、預估用掉多少次操作
npm run upload:exams                # 只上傳新的或大小不同的檔案
git add output && git commit        # 只會加入 meta
git push                            # Vercel 自動 build
```

- 一定要先上傳再 push，否則線上會出現打不開的考卷。
- Blob 上已經不在 catalog 裡的舊檔，等新版部署上線後用 `npm run upload:exams -- --prune` 刪除。
- 想在本機測 Blob 模式：在 `.env.development.local` 寫 `EXAMS_FILE_SOURCE=blob`，重開 `npm run dev`；測完刪掉這行。

免費方案（Hobby）的限制：Blob 儲存 1 GB、每月 2,000 次進階操作（每上傳一個檔案算一次，在後台瀏覽 store 也算）、每次開考卷經過函式轉送，吃 Blob 與 Fast Origin Transfer 各 10 GB／月。超過 Blob 額度時 store 會停用最多 30 天。Hobby 只能用在非商業用途。
````

- [ ] **Step 2: 檢查沒有殘留的舊設定**

```bash
grep -rn "NEXT_PUBLIC_EXAMS_BASE_URL\|sync:exams\|EXAMS_SOURCE_DIR\|public/exams" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs --exclude-dir=output . || echo clean
```

Expected: `clean`。

- [ ] **Step 3: 全面檢查**

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: 全部通過；build 的路由表有 `ƒ /exams/[...path]` 與 `/past-exams`，沒有 `⚠` 警告。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document past-exams output/, private Blob upload and /exams route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 手動驗證（瀏覽器與 Blob）

**Files:** 無程式變更（發現問題時回到對應 task 修正，先寫會失敗的測試）。

**Interfaces:**
- Consumes: 全部
- Produces: 驗證紀錄（寫進 ledger 或最終回報）

- [ ] **Step 1: 本機 local 模式**

用 `.claude/launch.json` 的 `web` 啟動（`predev` 會先產生目錄），在內建瀏覽器：

1. 1400×900：開 `/past-exams`，點一份 PDF → pdf.js 畫出全部頁面（canvas，不是 iframe）；按 ＋／−／百分比縮放；連按 → 五次，最後顯示的是清單上對應那份。
2. 點一份 Word → 顯示下載說明；下載連結是 `/exams/…?download=1`，回應的 `Content-Disposition` 是 `attachment` 且含中文標題。
3. 在 devtools 用 `fetch("/exams/pdf/math-grade-05-semester-1-nani/不存在.pdf")` 確認 404；用 `navigate` 直接開 `/exams/pdf/math-grade-05-semester-1-nani/20002871b5148af7683e.pdf` → 403「請從考古題頁面開啟這份考卷。」。
4. 點「在新分頁開啟」→ 新分頁顯示 PDF；在那個分頁重新整理，記錄是否被擋。
5. 375×812：點一份 → 全螢幕預覽層裡是 pdf.js 畫的頁面；放大到 200% 時只有預覽區可以左右捲動，整頁沒有橫向捲軸（`document.documentElement.scrollWidth === 375`）；返回鍵關閉預覽層。
6. 深色模式：頁面是白底 canvas，周圍與按鈕顏色正常。
7. 讀 console，除了開發模式的一般訊息外沒有錯誤。

- [ ] **Step 2: 上傳到私有 Blob**

```bash
npm run upload:exams -- --dry-run
npm run upload:exams
npm run upload:exams
SID=$(grep '^BLOB_STORE_ID=' .env.local | cut -d= -f2- | tr -d '"\r') && npx vercel blob get-store "$SID" | grep -E "Blob Count|Size|Access"
```

Expected: dry-run 顯示 192 份、約 193 次操作；正式上傳「上傳 192、跳過 0、失敗 0」；第二次「上傳 0、跳過 192」；store 顯示 `Blob Count: 192`、約 108 MB、`Access: Private`。

- [ ] **Step 3: 本機 Blob 模式**

```bash
printf 'EXAMS_FILE_SOURCE=blob\n' > .env.development.local
```

重開 dev server，在內建瀏覽器開一份 PDF 與一份 Word：都能顯示／下載；`read_network_requests` 看到 `/exams/...` 回 200（第二次開同一份可能是 304）。驗證完：

```bash
rm .env.development.local
```

並重開 dev server。

- [ ] **Step 4: 回報**

整理：測過的項目與結果、新分頁重新整理的行為、上傳數量與 store 狀態。部署到 Vercel 要先取得使用者同意；部署後再驗證線上 PDF 顯示、跨站請求 `/exams/...` 回 403、直接輸入網址回 403。
