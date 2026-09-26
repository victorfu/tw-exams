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
      // 不轉發 size 當 Content-Length：SDK 在上游沒有 Content-Length 時回 0，
      // 而 undici 解壓 gzip/br body 時不會跟著改上游的 Content-Length，size 可能只是壓縮後的長度。
      return { status: 200, body: result.stream, size: null, etag: result.blob.etag };
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
