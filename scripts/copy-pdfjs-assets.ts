// 用法：npm run pdfjs-assets（npm run dev／build 前會自動執行）
// 把 pdf.js 的 worker 等檔案複製到 public/pdfjs/，PDF 上傳與考古題預覽都從同源載入。
import { join, resolve } from "node:path";
import { copyPdfjsAssets } from "./pdfjsAssets.ts";

const repoRoot = resolve(import.meta.dirname, "..");
try {
  const version = await copyPdfjsAssets({
    packageDir: join(repoRoot, "node_modules", "pdfjs-dist"),
    publicDir: join(repoRoot, "public"),
  });
  console.log(`pdf.js 檔案：pdfjs-dist ${version} → public/pdfjs/${version}/`);
} catch (error) {
  console.error(`複製 pdf.js 檔案失敗：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
