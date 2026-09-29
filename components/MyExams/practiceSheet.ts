import type { BankQuestion, QuestionSource } from "../../types/questionBank";
import type { PastExamType } from "../../lib/pastExams/types";

interface ParamsLike {
  get(name: string): string | null;
}

export interface PracticeSheetRequest {
  datasetId: string;
  examType: PastExamType | null;
  academicYears: number[];
  count: number;
  title: string;
}

function parseCount(value: string | null): number {
  if (value === null || value.trim() === "") return 20;
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(100, Math.max(1, Math.floor(count))) : 20;
}

export function readPracticeSheetRequest(params: ParamsLike): PracticeSheetRequest | null {
  if (params.get("practice") !== "1") return null;
  const datasetId = params.get("datasetId");
  if (!datasetId) return null;
  const type = params.get("type");
  const examType: PastExamType | null = type === "midterm" || type === "final" ? type : null;
  const academicYears = (params.get("year") ?? "")
    .split(",")
    .filter((value) => /^\d+$/.test(value))
    .map(Number);
  return {
    datasetId,
    examType,
    academicYears,
    count: parseCount(params.get("count")),
    title: params.get("title")?.trim() || "考古題練習卷",
  };
}

export function practiceQuestionPool(
  sources: readonly QuestionSource[],
  questions: readonly BankQuestion[],
  request: PracticeSheetRequest,
): { sources: QuestionSource[]; questions: BankQuestion[] } {
  const years = new Set(request.academicYears);
  const matchedSources = sources.filter((source) => {
    const meta = source.pastExam;
    return Boolean(
      meta &&
        meta.datasetId === request.datasetId &&
        (!request.examType || meta.examType === request.examType) &&
        (years.size === 0 || years.has(meta.academicYear)),
    );
  });
  const sourceIds = new Set(matchedSources.map((source) => source.id));
  return {
    sources: matchedSources,
    questions: questions.filter((question) => sourceIds.has(question.sourceId)),
  };
}
