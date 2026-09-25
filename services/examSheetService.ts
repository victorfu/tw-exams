import type { ExamSheet } from "../types/questionBank";
import { clone, mockStore, newMockId } from "./mockStore";
import { requireCurrentUserId } from "./requireCurrentUserId";

export interface SheetInput {
  title: string;
  questionIds: readonly string[];
}

export async function listSheets(): Promise<ExamSheet[]> {
  requireCurrentUserId();
  return [...mockStore.sheets.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(clone);
}

export async function getSheet(sheetId: string): Promise<ExamSheet | null> {
  requireCurrentUserId();
  const sheet = mockStore.sheets.get(sheetId);
  return sheet ? clone(sheet) : null;
}

export async function createSheet(input: SheetInput): Promise<ExamSheet> {
  const userId = requireCurrentUserId();
  const now = new Date();
  const sheet: ExamSheet = {
    id: newMockId(),
    userId,
    title: input.title,
    questionIds: [...input.questionIds],
    createdAt: now,
    updatedAt: now,
  };
  mockStore.sheets.set(sheet.id, clone(sheet));
  return sheet;
}

export async function updateSheet(sheetId: string, input: SheetInput): Promise<void> {
  requireCurrentUserId();
  const existing = mockStore.sheets.get(sheetId);
  if (!existing) throw new Error("找不到這張考卷");
  mockStore.sheets.set(sheetId, {
    ...existing,
    title: input.title,
    questionIds: [...input.questionIds],
    updatedAt: new Date(),
  });
}

export async function deleteSheet(sheetId: string): Promise<void> {
  requireCurrentUserId();
  mockStore.sheets.delete(sheetId);
}
