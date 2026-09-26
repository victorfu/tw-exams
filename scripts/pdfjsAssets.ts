// 把 pdf.js 執行時要的檔案（worker、cMaps、字型、wasm、ICC）從 node_modules 複製到 public/，
// 同源提供，不必連 unpkg。Node 直接跑 TS，所以相對 import 要寫 .ts 副檔名。
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

/** 相對 pdfjs-dist 套件根目錄；utils/pdfConfig.ts 用同樣的相對路徑組網址。 */
export const PDFJS_ASSET_PATHS = [
  "legacy/build/pdf.worker.min.mjs",
  "cmaps",
  "standard_fonts",
  "wasm",
  "iccs",
] as const;

/**
 * 複製到 publicDir/pdfjs/<版本>/。網址帶版本，升級 pdfjs-dist 後瀏覽器不會拿到舊的 worker；
 * 舊版本的資料夾先整個清掉。回傳版本號。
 */
export async function copyPdfjsAssets({
  packageDir,
  publicDir,
}: {
  packageDir: string;
  publicDir: string;
}): Promise<string> {
  const { version } = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")) as {
    version: string;
  };
  const root = join(publicDir, "pdfjs");
  await rm(root, { recursive: true, force: true });
  for (const path of PDFJS_ASSET_PATHS) {
    const target = join(root, version, path);
    await mkdir(join(target, ".."), { recursive: true });
    await cp(join(packageDir, path), target, { recursive: true });
  }
  return version;
}
