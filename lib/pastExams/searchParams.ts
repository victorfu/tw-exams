import type { PastExamType } from "./types";

/** `/past-exams` 的篩選狀態都放在網址：c、year、type、city、q、id、view。 */
export interface PastExamsUrlState {
  collectionId: string | null;
  academicYears: number[];
  examType: PastExamType | null;
  city: string | null;
  query: string;
  examId: string | null;
  /** 預覽看解答卷（`view=answer`）；否則看題目卷。 */
  showAnswer: boolean;
}

interface ParamsLike {
  get(name: string): string | null;
}

export function readUrlState(params: ParamsLike): PastExamsUrlState {
  const type = params.get("type");
  return {
    collectionId: params.get("c") || null,
    academicYears: (params.get("year") ?? "")
      .split(",")
      .filter((value) => /^\d+$/.test(value))
      .map(Number),
    examType: type === "midterm" || type === "final" ? type : null,
    city: params.get("city") || null,
    query: params.get("q") ?? "",
    examId: params.get("id") || null,
    showAnswer: params.get("view") === "answer",
  };
}

/** 回傳不含「?」的 query string；空值不寫。 */
export function writeUrlState(state: PastExamsUrlState): string {
  const params = new URLSearchParams();
  if (state.collectionId) params.set("c", state.collectionId);
  if (state.academicYears.length > 0) params.set("year", state.academicYears.join(","));
  if (state.examType) params.set("type", state.examType);
  if (state.city) params.set("city", state.city);
  if (state.query) params.set("q", state.query);
  if (state.examId) params.set("id", state.examId);
  // 沒開考卷時看哪一面沒有意義，不寫進網址。
  if (state.examId && state.showAnswer) params.set("view", "answer");
  return params.toString();
}
