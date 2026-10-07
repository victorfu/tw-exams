import { readUrlState, writeUrlState } from "../../lib/pastExams/searchParams";
import { clearPickedQuestions } from "../PastExams/selectionState";
import { useSyncExternalStore } from "react";
import { newMockId } from "../../services/mockStore";
import { isBankSubject, type QuestionSource } from "../../types/questionBank";

export function listHref(params: URLSearchParams): string {
  const query = params.toString();
  return `/my-exams${query ? `?${query}` : ""}`;
}

/** Only a local list route is a valid return destination. Never navigate arbitrary input. */
export function safeReturnTo(value: string | null | undefined, fallback = "/my-exams"): string {
  if (value && /^\/past-exams(?:\?|$)/.test(value) && !/[\\\r\n]/.test(value)) {
    const url = new URL(value, "https://local.invalid");
    if (url.pathname !== "/past-exams" || url.hash) return fallback;
    const query = writeUrlState(readUrlState(url.searchParams));
    return `/past-exams${query ? `?${query}` : ""}`;
  }
  if (!value || !/^\/my-exams(?:\?|$)/.test(value) || /[\\\r\n]/.test(value)) return fallback;
  const url = new URL(value, "https://local.invalid");
  if (url.pathname !== "/my-exams" || url.hash) return fallback;
  const params = new URLSearchParams();
  for (const key of ["tab", "subject", "source", "search"]) {
    const item = url.searchParams.get(key);
    if (item) params.set(key, item);
  }
  if (!["sources", "sheets"].includes(params.get("tab") ?? "")) params.delete("tab");
  if (!isBankSubject(params.get("subject") ?? "")) params.delete("subject");
  return listHref(params);
}

export function sourceEditorHref(sourceId: string, returnTo: string, questionId?: string): string {
  const params = new URLSearchParams();
  if (questionId) params.set("q", questionId);
  params.set("returnTo", safeReturnTo(returnTo));
  return `/my-exams/sources/${encodeURIComponent(sourceId)}?${params}`;
}

export function latestSource(sources: readonly QuestionSource[]): QuestionSource | undefined {
  return [...sources].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id))[0];
}

type SelectionState = { active: boolean; ids: readonly string[] };
const empty: SelectionState = { active: false, ids: [] };
let selection = empty;
const listeners = new Set<() => void>();
function publish(next: SelectionState) {
  selection = next;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useWorkspaceSelection() {
  return useSyncExternalStore(subscribe, () => selection, () => empty);
}
export function startSelection() { publish({ ...selection, active: true }); }
export function clearSelection() { publish({ ...selection, ids: [] }); }
export function exitSelection() { publish(empty); }
export function toggleQuestion(id: string) {
  publish({ active: true, ids: selection.ids.includes(id) ? selection.ids.filter((item) => item !== id) : [...selection.ids, id] });
}

interface SelectionDraft { ids: readonly string[]; returnTo: string }
const drafts = new Map<string, SelectionDraft>();
export function createSelectionDraft(ids: readonly string[], returnTo: string): string {
  const token = `selection-${newMockId()}`;
  drafts.set(token, { ids: [...new Set(ids)], returnTo: safeReturnTo(returnTo) });
  return token;
}
export function readSelectionDraft(token: string): SelectionDraft | undefined { return drafts.get(token); }
export function completeSelectionDraft(token: string) {
  const draft = drafts.get(token);
  drafts.delete(token);
  if (draft?.returnTo.startsWith("/past-exams")) clearPickedQuestions();
  else exitSelection();
}
export const listScrollPositions = new Map<string, number>();

export function resetWorkspaceState() {
  drafts.clear();
  listScrollPositions.clear();
  exitSelection();
}
