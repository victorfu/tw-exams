import type { BankQuestion, QuestionSource } from "../types/questionBank";
import { clone, mockStore, newMockId } from "./mockStore";
import { requireCurrentUserId } from "./requireCurrentUserId";

export function newBankQuestionId(): string {
  return newMockId();
}

function questionsForSource(sourceId: string): BankQuestion[] {
  return [...mockStore.questions.values()].filter(
    (question) => question.sourceId === sourceId,
  );
}

/** 全量載入（題庫預期數百題），排序交給前端（spec §4）。 */
export async function listBankQuestions(): Promise<BankQuestion[]> {
  requireCurrentUserId();
  return [...mockStore.questions.values()].map(clone);
}

export async function listQuestionsForSource(sourceId: string): Promise<BankQuestion[]> {
  requireCurrentUserId();
  return questionsForSource(sourceId).map(clone);
}

export async function deleteQuestionsForSource(sourceId: string): Promise<void> {
  requireCurrentUserId();
  for (const question of questionsForSource(sourceId)) {
    mockStore.questions.delete(question.id);
  }
}

export interface EditorCommit {
  upserts: readonly BankQuestion[];
  deleteIds: readonly string[];
  /** 遮蓋或標題有變更時才帶。 */
  source: Pick<QuestionSource, "id" | "title" | "pages"> | null;
}

/** 空白答案不存（沒有答案時不留 answer 欄位）。 */
function normalizeQuestion(question: BankQuestion, now: Date): BankQuestion {
  const { answer, ...rest } = clone(question);
  const trimmed = answer?.trim();
  return { ...rest, ...(trimmed ? { answer: trimmed } : {}), updatedAt: now };
}

/** 裁題畫面的自動儲存（spec §8.4）。來源的更新排在最後。 */
export async function commitEditorChanges(commit: EditorCommit): Promise<void> {
  requireCurrentUserId();
  const now = new Date();
  for (const question of commit.upserts) {
    mockStore.questions.set(question.id, normalizeQuestion(question, now));
  }
  for (const id of commit.deleteIds) {
    mockStore.questions.delete(id);
  }
  const { source } = commit;
  if (source) {
    const existing = mockStore.sources.get(source.id);
    if (!existing) throw new Error("找不到這份上傳紀錄");
    mockStore.sources.set(source.id, {
      ...existing,
      title: source.title,
      pages: clone(source.pages),
      updatedAt: now,
    });
  }
}
