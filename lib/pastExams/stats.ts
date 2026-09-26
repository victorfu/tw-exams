import { gradeLabel, semesterLabel, SUBJECTS, subjectLabel } from "./labels";
import type { PastExamCatalog } from "./types";

export interface CatalogStats {
  /** 已下載、能在站上開啟的考卷份數。 */
  exams: number;
  /** 附解答卷的份數。 */
  answers: number;
  /** 有考卷的科目，依固定科目清單的順序（不認得的排最後）。 */
  subjects: { id: string; label: string; count: number }[];
  /** 收錄的年級學期，例如「五年級上學期」，由低到高。 */
  terms: string[];
}

/** 首頁用的收錄數字；從目錄算，資料更新時自動跟著變。 */
export function catalogStats({ datasets, exams }: PastExamCatalog): CatalogStats {
  const available = exams.filter((exam) => exam.available);
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));

  const counts = new Map<string, number>();
  const terms = new Map<number, string>();
  for (const exam of available) {
    const dataset = datasetById.get(exam.datasetId);
    if (!dataset) continue;
    counts.set(dataset.subject, (counts.get(dataset.subject) ?? 0) + 1);
    terms.set(dataset.grade * 10 + dataset.semester, `${gradeLabel(dataset.grade)}${semesterLabel(dataset.semester)}`);
  }

  const rank = (subject: string) => {
    const index = SUBJECTS.findIndex((item) => item.id === subject);
    return index === -1 ? SUBJECTS.length : index;
  };
  return {
    exams: available.length,
    answers: available.filter((exam) => exam.answer !== null).length,
    subjects: [...counts]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([id, count]) => ({ id, label: subjectLabel(id, datasets), count })),
    terms: [...terms].sort(([a], [b]) => a - b).map(([, label]) => label),
  };
}
