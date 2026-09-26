import { QUESTION_BANK_STORAGE_FOLDER } from "../constants/questionBank";
import type { BankSubject, QuestionSource, SourcePage } from "../types/questionBank";
import type { RenderedPage } from "../utils/pageImageProcessor";
import { deleteQuestionsForSource } from "./bankQuestionService";
import {
  clone,
  mockStore,
  newMockId,
  pageImageUrl,
  putPageImage,
  removePageImages,
} from "./mockStore";
import { requireCurrentUserId } from "./requireCurrentUserId";

export function createQuestionSourcePath(
  userId: string,
  sourceId: string,
  pageIndex: number,
): string {
  return `${QUESTION_BANK_STORAGE_FOLDER}/${userId}/${sourceId}/page-${pageIndex}.jpg`;
}

export function newQuestionSourceId(): string {
  return newMockId();
}

export interface CreateSourceInput {
  /** 重試時沿用同一個 id，覆寫上次殘留的頁圖（spec §7）。 */
  sourceId: string;
  title: string;
  subject: BankSubject;
  pageCount: number;
  /** 依序呼叫：前一頁存好才會要求下一頁，一次只有一頁在記憶體。 */
  renderPage: (pageIndex: number) => Promise<RenderedPage>;
  onProgress?: (uploaded: number, total: number) => void;
}

export async function createSource(input: CreateSourceInput): Promise<QuestionSource> {
  const userId = requireCurrentUserId();
  const pages: SourcePage[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (let pageIndex = 0; pageIndex < input.pageCount; pageIndex += 1) {
      const rendered = await input.renderPage(pageIndex);
      const storagePath = createQuestionSourcePath(userId, input.sourceId, pageIndex);
      putPageImage(storagePath, rendered.blob);
      uploadedPaths.push(storagePath);
      pages.push({ storagePath, width: rendered.width, height: rendered.height, masks: [] });
      input.onProgress?.(pageIndex + 1, input.pageCount);
    }
  } catch (error) {
    removePageImages(uploadedPaths);
    throw error;
  }

  const now = new Date();
  const source: QuestionSource = {
    id: input.sourceId,
    userId,
    title: input.title,
    subject: input.subject,
    pages,
    createdAt: now,
    updatedAt: now,
  };
  mockStore.sources.set(source.id, clone(source));
  return source;
}

export async function listSources(): Promise<QuestionSource[]> {
  requireCurrentUserId();
  return [...mockStore.sources.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(clone);
}

export async function getSource(sourceId: string): Promise<QuestionSource | null> {
  requireCurrentUserId();
  const source = mockStore.sources.get(sourceId);
  return source ? clone(source) : null;
}

/**
 * 頁圖的顯示網址，取代原本的 Supabase signed URL：現在直接給記憶體裡的 object URL。
 * 還沒存好（或已刪除）的路徑不放進結果，呼叫端視為「尚未取得」。
 * `force` 是圖片載入失敗後的重試：接真正的後端時要略過快取重新簽；
 * object URL 不會過期，所以這裡用不到。
 */
export async function getPageImageUrls(
  paths: readonly string[],
  force = false,
): Promise<Record<string, string>> {
  requireCurrentUserId();
  void force;
  const urls: Record<string, string> = {};
  for (const path of paths) {
    const url = pageImageUrl(path);
    if (url) urls[path] = url;
  }
  return urls;
}

/** 先刪題目，再刪來源，最後刪頁圖（spec §10）。 */
export async function deleteSource(source: QuestionSource): Promise<void> {
  requireCurrentUserId();
  await deleteQuestionsForSource(source.id);
  mockStore.sources.delete(source.id);
  removePageImages(source.pages.map((page) => page.storagePath));
}
