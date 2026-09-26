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
