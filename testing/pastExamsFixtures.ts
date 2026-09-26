import type { PastExam, PastExamCatalog, PastExamCollection } from "../lib/pastExams/types";

export const MATH_5A: PastExamCollection = {
  id: "math-grade-05-semester-1-nani",
  subject: "math",
  subjectLabel: "數學",
  grade: 5,
  semester: 1,
  publisher: "nani",
  publisherLabel: "南一",
};

let sequence = 0;

export function makeExam(overrides: Partial<PastExam> = {}): PastExam {
  sequence += 1;
  const academicYear = overrides.academicYear ?? 114;
  const city = overrides.city === undefined ? "臺北市" : overrides.city;
  const school = overrides.school === undefined ? `學校${sequence}國小` : overrides.school;
  const format = overrides.format ?? "pdf";
  return {
    id: `tcool:${sequence}`,
    datasetId: MATH_5A.id,
    academicYear,
    academicYearLabel: `${academicYear}上`,
    examType: "midterm",
    examTypeLabel: "期中考",
    examRound: 1,
    periodLabel: "期中1",
    city,
    school,
    title: `${academicYear}上｜${city ?? ""} ${school ?? ""}｜5年級數學｜南一｜期中1`,
    file: format === "pdf" ? `pdf/${MATH_5A.id}/${sequence}.pdf` : `doc/${MATH_5A.id}/${sequence}.doc`,
    format,
    pages: format === "pdf" ? 4 : null,
    bytes: 1000,
    available: true,
    answer: null,
    // 與 cowork 的 search_text 一樣把「臺」寫成「台」。
    searchText: `${academicYear}上|${city ?? ""} ${school ?? ""}|5年級數學|南一 五上`.replaceAll("臺", "台"),
    ...overrides,
  };
}

export function makeCatalog(exams: PastExam[], datasets: PastExamCollection[] = [MATH_5A]): PastExamCatalog {
  return { generatedAt: "2026-09-25T21:28:57+08:00", datasets, exams };
}
