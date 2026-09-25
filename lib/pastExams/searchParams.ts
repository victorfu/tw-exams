import type { PastExamType } from "./types";

/** `/past-exams` 的篩選狀態都放在網址：c、year、type、city、q、id。 */
export interface PastExamsUrlState {
  collectionId: string | null;
  academicYears: number[];
  examType: PastExamType | null;
  city: string | null;
  query: string;
  examId: string | null;
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
  return params.toString();
}
