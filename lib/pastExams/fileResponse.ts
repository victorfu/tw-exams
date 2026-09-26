import type { PastExam } from "./types";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** 檔名本身的副檔名（不看資料夾名稱）；沒有時回傳 null。 */
function extensionOf(file: string): string | null {
  return /\.([^./]+)$/.exec(file)?.[1] ?? null;
}

/** 依副檔名決定 Content-Type；不認得的一律當成二進位檔。 */
export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[extensionOf(file)?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** 下載檔名：考卷標題＋副檔名；檔名沒有副檔名時依格式補上。 */
export function downloadFileName(exam: PastExam): string {
  return `${exam.title}.${extensionOf(exam.file) ?? (exam.format === "pdf" ? "pdf" : "doc")}`;
}

/** RFC 6266：ASCII 後備檔名（原始檔名）加上 UTF-8 的中文標題。 */
export function contentDisposition(exam: PastExam, download: boolean): string {
  const fallback = (exam.file.split("/").pop() ?? "exam").replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(downloadFileName(exam)).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** 只讓本站嵌入與讀取、不被搜尋引擎收錄；刻意不送任何 Access-Control-* header。 */
export const EXAM_FILE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Robots-Tag": "noindex, nofollow",
};
