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
