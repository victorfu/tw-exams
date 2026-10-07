import { useSyncExternalStore } from "react";
import type { BankQuestion } from "../../types/questionBank";

export interface PickedQuestion { question: BankQuestion; title: string }
interface Selection { examIds: readonly string[]; questions: readonly PickedQuestion[] }
const empty: Selection = { examIds: [], questions: [] };
let selection = empty;
const listeners = new Set<() => void>();
function publish(next: Selection) {
  selection = next;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function usePastExamSelection() {
  return useSyncExternalStore(subscribe, () => selection, () => empty);
}
export function toggleExam(id: string) {
  publish({ ...selection, examIds: selection.examIds.includes(id) ? selection.examIds.filter((item) => item !== id) : [...selection.examIds, id] });
}
export function selectExams(ids: readonly string[]) {
  publish({ ...selection, examIds: [...new Set([...selection.examIds, ...ids])] });
}
export function clearExams() { publish({ ...selection, examIds: [] }); }
export function addPickedQuestion(question: BankQuestion, title: string) {
  if (selection.questions.some((item) => item.question.id === question.id)) return;
  publish({ ...selection, questions: [...selection.questions, { question, title }] });
}
export function removePickedQuestion(id: string) {
  publish({ ...selection, questions: selection.questions.filter((item) => item.question.id !== id) });
}
export function clearPickedQuestions() { publish({ ...selection, questions: [] }); }
/** 編輯或刪除框題時同步已選項目，未選取的既有題目不會自動加入。 */
export function syncPickedQuestions(sourceId: string, questions: readonly BankQuestion[], title: string) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  publish({ ...selection, questions: selection.questions.flatMap((item) => {
    if (item.question.sourceId !== sourceId) return [item];
    const question = byId.get(item.question.id);
    return question ? [{ question, title }] : [];
  }) });
}
export function resetPastExamSelection() { publish(empty); }
