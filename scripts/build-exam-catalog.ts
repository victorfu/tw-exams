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
