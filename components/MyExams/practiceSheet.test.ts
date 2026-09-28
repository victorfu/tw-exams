import { describe, expect, it } from "vitest";
import type { BankQuestion, QuestionSource } from "../../types/questionBank";
import { practiceQuestionPool, readPracticeSheetRequest } from "./practiceSheet";

function params(values: Record<string, string>): URLSearchParams {
  return new URLSearchParams(values);
}

function source(id: string, datasetId: string | null, examType: "midterm" | "final" = "midterm", academicYear = 114): QuestionSource {
  const now = new Date("2026-09-29T00:00:00Z");
  return {
    id,
    userId: "u",
    title: id,
    subject: "math",
    pages: [],
    ...(datasetId
      ? { pastExam: { examId: `exam-${id}`, datasetId, examType, academicYear } }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function question(id: string, sourceId: string): BankQuestion {
  const now = new Date("2026-09-29T00:00:00Z");
  return {
    id,
    userId: "u",
    sourceId,
    subject: "math",
    regions: [{ pageIndex: 0, box: { x: 0, y: 0, w: 1, h: 1 } }],
    answerSpace: "none",
    createdAt: now,
    updatedAt: now,
  };
}

describe("readPracticeSheetRequest", () => {
  it("reads the current past-exam filters and defaults safely", () => {
    const request = readPracticeSheetRequest(params({
      practice: "1",
      datasetId: "math-5a-nani",
      type: "midterm",
      year: "114,113,not-a-year",
      count: "20",
      title: "五上數學南一期中練習卷",
    }));
    expect(request).toEqual({
      datasetId: "math-5a-nani",
      examType: "midterm",
      academicYears: [114, 113],
      count: 20,
      title: "五上數學南一期中練習卷",
    });
  });

  it("requires practice mode and a dataset", () => {
    expect(readPracticeSheetRequest(params({ datasetId: "x" }))).toBeNull();
    expect(readPracticeSheetRequest(params({ practice: "1" }))).toBeNull();
  });
});

describe("practiceQuestionPool", () => {
  it("only keeps questions from matching dataset, exam type, and academic year", () => {
    const sources = [
      source("a", "math-5a-nani", "midterm", 114),
      source("b", "math-5a-nani", "final", 114),
      source("c", "math-5a-nani", "midterm", 113),
      source("d", "math-5a-kang", "midterm", 114),
      source("manual", null),
    ];
    const questions = sources.map((item) => question(`q-${item.id}`, item.id));
    const pool = practiceQuestionPool(sources, questions, {
      datasetId: "math-5a-nani",
      examType: "midterm",
      academicYears: [114],
      count: 20,
      title: "test",
    });
    expect(pool.sources.map((item) => item.id)).toEqual(["a"]);
    expect(pool.questions.map((item) => item.id)).toEqual(["q-a"]);
  });

  it("allows all exam types and years when those filters are empty", () => {
    const sources = [
      source("a", "math-5a-nani", "midterm", 114),
      source("b", "math-5a-nani", "final", 113),
      source("c", "math-5a-kang", "midterm", 114),
    ];
    const questions = sources.map((item) => question(`q-${item.id}`, item.id));
    const pool = practiceQuestionPool(sources, questions, {
      datasetId: "math-5a-nani",
      examType: null,
      academicYears: [],
      count: 20,
      title: "test",
    });
    expect(pool.questions.map((item) => item.id)).toEqual(["q-a", "q-b"]);
  });
});
