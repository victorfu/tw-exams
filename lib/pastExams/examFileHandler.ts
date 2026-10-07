import { isSafeRelativePath } from "./buildCatalog";
import { contentDisposition, contentTypeFor, EXAM_FILE_SECURITY_HEADERS } from "./fileResponse";
import type { ExamFileEntry } from "./examIndex";

export type ExamFileReadResult =
  | { status: 200; body: ReadableStream<Uint8Array>; size: number | null; etag: string | null }
  | { status: 304; etag: string | null }
  | { status: 404 };

export interface ExamFileSource {
  /** 本機 no-store；Blob 用 private, no-cache（瀏覽器可快取，但每次都回來驗證）。 */
  cacheControl: string;
  read(file: string, ifNoneMatch: string | null): Promise<ExamFileReadResult>;
}

export interface ExamFileHandlerDeps {
  findFile: (file: string) => ExamFileEntry | undefined;
  source: ExamFileSource;
}

function textResponse(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/** /exams/<relative_path>：只提供 catalog 裡已下載的題目卷與解答卷，允許公開直連。 */
export async function handleExamFileRequest(
  request: Request,
  segments: readonly string[],
  { findFile, source }: ExamFileHandlerDeps,
): Promise<Response> {
  const file = segments.join("/");
  if (!isSafeRelativePath(file)) return textResponse(404, "找不到這份考卷。");
  const entry = findFile(file);
  if (!entry) return textResponse(404, "找不到這份考卷。");

  const result = await source.read(file, request.headers.get("if-none-match"));
  if (result.status === 404) return textResponse(404, "找不到這份考卷。");

  const headers = new Headers({ ...EXAM_FILE_SECURITY_HEADERS, "Cache-Control": source.cacheControl });
  if (result.etag) headers.set("ETag", result.etag);
  if (result.status === 304) return new Response(null, { status: 304, headers });

  const download = new URL(request.url).searchParams.get("download") === "1";
  headers.set("Content-Type", contentTypeFor(file));
  headers.set("Content-Disposition", contentDisposition(entry.exam, download, entry.role));
  if (result.size !== null) headers.set("Content-Length", String(result.size));
  return new Response(result.body, { status: 200, headers });
}
