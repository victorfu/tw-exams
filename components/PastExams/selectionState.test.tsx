import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { makeQuestion } from "../../testing/questionBankFixtures";
import { addPickedQuestion, removePickedQuestion, resetPastExamSelection, syncPickedQuestions, toggleExam, usePastExamSelection } from "./selectionState";
import { completeSelectionDraft, createSelectionDraft, readSelectionDraft } from "../MyExams/workspaceState";
let root: Root;
let container: HTMLDivElement;
let snapshot: ReturnType<typeof usePastExamSelection>;
function Reader() { const value = usePastExamSelection(); useEffect(() => { snapshot = value; }, [value]); return null; }
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetPastExamSelection();
  container = document.createElement("div"); root = createRoot(container);
  act(() => root.render(<Reader />));
});
afterEach(() => { act(() => root.unmount()); });
it("keeps ordered unique questions across sources, updates edits and removes deleted questions", () => {
  const a = makeQuestion({ id: "a" });
  const b = makeQuestion({ id: "b", sourceId: "other" });
  act(() => { addPickedQuestion(a, "A"); addPickedQuestion(b, "B"); addPickedQuestion(a, "A"); toggleExam("exam"); });
  expect(snapshot.questions.map((item) => item.question.id)).toEqual(["a", "b"]);
  act(() => syncPickedQuestions(a.sourceId, [{ ...a, answer: "42" }], "Renamed"));
  expect(snapshot.questions[0].question.answer).toBe("42");
  act(() => removePickedQuestion("a"));
  expect(snapshot.questions.map((item) => item.question.id)).toEqual(["b"]);
  act(() => { addPickedQuestion(a, "A"); syncPickedQuestions("other", [], "B"); });
  expect(snapshot.questions.map((item) => item.question.id)).toEqual(["a"]);
  const token = createSelectionDraft(["a"], "/past-exams?c=math&id=exam");
  expect(readSelectionDraft(token)?.returnTo).toBe("/past-exams?c=math&id=exam");
  act(() => completeSelectionDraft(token));
  expect(snapshot.questions).toEqual([]);
  expect(snapshot.examIds).toEqual(["exam"]);
});
