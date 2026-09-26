import type { ExamFileRole, PastExam } from "./types";

/** 某個檔案屬於哪份考卷、是題目卷還是解答卷。 */
export interface ExamFileEntry {
  exam: PastExam;
  role: ExamFileRole;
}

/** 以檔案路徑查已下載的題目卷或解答卷；/exams 路由只提供查得到的檔案。 */
export function createExamFileLookup(exams: readonly PastExam[]): (file: string) => ExamFileEntry | undefined {
  const byFile = new Map<string, ExamFileEntry>();
  for (const exam of exams) {
    if (exam.available) byFile.set(exam.file, { exam, role: "question" });
    if (exam.answer) byFile.set(exam.answer.file, { exam, role: "answer" });
  }
  return (file) => byFile.get(file);
}
