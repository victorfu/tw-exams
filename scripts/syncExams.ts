// 從 cowork 的 output/ 同步考古題：catalog 精簡成 data/pastExams.json，考卷檔鏡像複製到
// public/exams/。來源只讀。Node 直接跑 TS，所以相對 import 要寫 .ts 副檔名。
import { copyFile, mkdir, readFile, readdir, rename, rmdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { buildCatalog, CatalogError, parseCatalogJsonl, type CatalogInfo } from "../lib/pastExams/buildCatalog.ts";
import type { PastExamCatalog } from "../lib/pastExams/types.ts";

export interface SyncExamsOptions {
  sourceDir: string;
  dataFile: string;
  publicExamsDir: string;
}

export interface SyncExamsSummary {
  exams: number;
  copied: number;
  skipped: number;
  removed: number;
}

export async function syncExams({ sourceDir, dataFile, publicExamsDir }: SyncExamsOptions): Promise<SyncExamsSummary> {
  // 先讀完、驗證完，才開始寫任何東西。
  const info = JSON.parse(await readFile(join(sourceDir, "catalog-info.json"), "utf8")) as CatalogInfo;
  const records = parseCatalogJsonl(await readFile(join(sourceDir, "catalog.jsonl"), "utf8"));
  const catalog = buildCatalog(info, records);

  const files = catalog.exams.filter((exam) => exam.available).map((exam) => exam.file);
  const sources = new Map<string, Stats>();
  for (const file of files) {
    const source = await fileStat(join(sourceDir, ...file.split("/")));
    if (source === null) throw new CatalogError(`catalog 標示已下載，但來源沒有這個檔案：${file}`);
    sources.set(file, source);
  }

  // 先刪舊檔再複製：大小寫不分的檔案系統上，只改了大小寫的路徑才會照新的寫法重建。
  const removed = await pruneStaleFiles(publicExamsDir, new Set(files));

  let copied = 0;
  let skipped = 0;
  for (const file of files) {
    const source = sources.get(file)!;
    const destination = join(publicExamsDir, ...file.split("/"));
    const current = await fileStat(destination);
    // 大小與修改時間都一樣才跳過（複製後會把修改時間設成來源的）。
    if (current && current.size === source.size && Math.abs(current.mtimeMs - source.mtimeMs) < 1) {
      skipped += 1;
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(sourceDir, ...file.split("/")), destination);
    await utimes(destination, source.atimeMs / 1000, source.mtimeMs / 1000);
    copied += 1;
  }

  // 檔案都到位了才寫 catalog：任何一步失敗，data/pastExams.json 都維持原樣。
  await writeFileAtomic(dataFile, formatCatalogJson(catalog));
  return { exams: catalog.exams.length, copied, skipped, removed };
}

async function fileStat(path: string): Promise<Stats | null> {
  try {
    const info = await stat(path);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, path);
}

/** 頂層結構縮排，每份考卷一行：檔案不會太大，git diff 也看得出哪幾份變了。 */
function formatCatalogJson(catalog: PastExamCatalog): string {
  const list = (items: readonly unknown[]) => items.map((item) => `    ${JSON.stringify(item)}`).join(",\n");
  return [
    "{",
    `  "generatedAt": ${JSON.stringify(catalog.generatedAt)},`,
    `  "datasets": [\n${list(catalog.datasets)}\n  ],`,
    `  "exams": [\n${list(catalog.exams)}\n  ]`,
    "}",
    "",
  ].join("\n");
}

/** 刪掉 publicExamsDir 裡不在 keep 中的檔案與因此變空的資料夾；只動 publicExamsDir 底下。 */
async function pruneStaleFiles(publicExamsDir: string, keep: ReadonlySet<string>): Promise<number> {
  let removed = 0;
  async function walk(dir: string): Promise<boolean> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // 不存在或讀不到：當成非空，上一層就不會去 rmdir。
      return false;
    }
    let empty = true;
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (await walk(path)) await rmdir(path);
        else empty = false;
      } else if (keep.has(relative(publicExamsDir, path).split(sep).join("/"))) {
        empty = false;
      } else {
        await unlink(path);
        removed += 1;
      }
    }
    return empty;
  }
  await walk(publicExamsDir);
  return removed;
}
