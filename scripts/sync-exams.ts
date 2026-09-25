// 用法：npm run sync:exams -- [cowork 的 output 目錄]
// 沒給目錄時讀 EXAMS_SOURCE_DIR（可寫在 .env.local），再沒有就用預設路徑。
import { join, resolve } from "node:path";
import { syncExams } from "./syncExams.ts";

const DEFAULT_SOURCE_DIR = "/Users/victor/Codebase/cowork/output";

const repoRoot = resolve(import.meta.dirname, "..");
const sourceDir = resolve(process.argv[2] ?? process.env.EXAMS_SOURCE_DIR ?? DEFAULT_SOURCE_DIR);

console.log(`來源：${sourceDir}`);
try {
  const summary = await syncExams({
    sourceDir,
    dataFile: join(repoRoot, "data", "pastExams.json"),
    publicExamsDir: join(repoRoot, "public", "exams"),
  });
  console.log(
    `完成：${summary.exams} 份考卷寫入 data/pastExams.json；public/exams 複製 ${summary.copied}、跳過 ${summary.skipped}、刪除 ${summary.removed}。`,
  );
} catch (error) {
  console.error(`同步失敗，沒有覆寫既有輸出：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
