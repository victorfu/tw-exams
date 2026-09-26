import type { PastExam } from "./types";

/** 以檔案路徑查已下載的考卷；/exams 路由只提供查得到的檔案。 */
export function createAvailableExamLookup(exams: readonly PastExam[]): (file: string) => PastExam | undefined {
  const byFile = new Map(exams.filter((exam) => exam.available).map((exam) => [exam.file, exam]));
  return (file) => byFile.get(file);
}
