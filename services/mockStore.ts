import type { BankQuestion, ExamSheet, QuestionSource } from "../types/questionBank";

/**
 * 暫代 Firestore 與 Storage 的記憶體儲存：沒有登入、也不真的存下來，
 * 重新整理頁面就清空。讀寫一律複製，元件拿到的物件改了也不會影響這裡。
 */
const sources = new Map<string, QuestionSource>();
const questions = new Map<string, BankQuestion>();
const sheets = new Map<string, ExamSheet>();
const pageImages = new Map<string, Blob>();
const pageImageUrls = new Map<string, string>();

export const mockStore = { sources, questions, sheets };

export function newMockId(): string {
  return crypto.randomUUID();
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function putPageImage(path: string, blob: Blob): void {
  revokePageImageUrl(path);
  pageImages.set(path, blob);
}

export function removePageImages(paths: readonly string[]): void {
  for (const path of paths) {
    revokePageImageUrl(path);
    pageImages.delete(path);
  }
}

export function hasPageImage(path: string): boolean {
  return pageImages.has(path);
}

/** 取代 signed URL：同一張頁圖重複使用同一個 object URL。 */
export function pageImageUrl(path: string): string | undefined {
  const cached = pageImageUrls.get(path);
  if (cached) return cached;
  const blob = pageImages.get(path);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  pageImageUrls.set(path, url);
  return url;
}

function revokePageImageUrl(path: string): void {
  const url = pageImageUrls.get(path);
  if (!url) return;
  URL.revokeObjectURL(url);
  pageImageUrls.delete(path);
}

/** 測試用：清空所有資料。 */
export function resetMockStore(): void {
  removePageImages([...pageImages.keys()]);
  sources.clear();
  questions.clear();
  sheets.clear();
}
