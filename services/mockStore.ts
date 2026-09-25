import type { BankQuestion, ExamSheet, QuestionSource } from "../types/questionBank";

/**
 * 暫代 Firestore 與 Storage 的記憶體儲存：沒有登入、也不真的存下來，
 * 只活在目前這個分頁，重新整理或開新分頁就是空的。
 * 讀寫一律複製，元件拿到的物件改了也不會影響這裡。
 */
const sources = new Map<string, QuestionSource>();
const questions = new Map<string, BankQuestion>();
const sheets = new Map<string, ExamSheet>();
const pageImages = new Map<string, Blob>();
const pageImageUrls = new Map<string, string>();

export const mockStore = { sources, questions, sheets };

/**
 * crypto.randomUUID 只在安全來源（HTTPS、localhost）才有；用區網 IP 開啟時
 * 改用 getRandomValues 自己組 UUID v4。
 */
export function newMockId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
