// 用法：npm run sync:exams -- <cowork 的 output 目錄>
// 沒給目錄時讀 EXAMS_SOURCE_DIR（可寫在 .env.local）；兩個都沒有就提示用法後結束。
import { join, resolve } from "node:path";
import { syncExams } from "./syncExams.ts";

const repoRoot = resolve(import.meta.dirname, "..");
const source = process.argv[2] ?? process.env.EXAMS_SOURCE_DIR;
if (!source) {
  console.error("請指定 cowork 的 output 目錄：npm run sync:exams -- <目錄>，或在 .env.local 設定 EXAMS_SOURCE_DIR。");
  process.exit(1);
}
const sourceDir = resolve(source);

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
  console.error(`同步失敗，data/pastExams.json 沒有更新：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
