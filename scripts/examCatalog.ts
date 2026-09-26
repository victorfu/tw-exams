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
