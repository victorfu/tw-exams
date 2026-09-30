import { groupByAcademicYear, sortExams, type AcademicYearGroup } from "./filters";
import { gradeLabel, gradeNumeral, semesterLabel } from "./labels";
import { writeUrlState, type PastExamsUrlState } from "./searchParams";
import type { PastExam, PastExamCatalog, PastExamCollection } from "./types";

/**
 * 資料集的落地頁（`/past-exams/[collection]`）：給搜尋引擎看的靜態清單，
 * 每份考卷連到 `/past-exams` 的預覽。
 */
export function collectionPath(collection: Pick<PastExamCollection, "id">): string {
  return `/past-exams/${collection.id}`;
}

/** 例如「五年級上學期英語考古題（康軒版）」。 */
export function collectionHeading(collection: PastExamCollection): string {
  return `${gradeLabel(collection.grade)}${semesterLabel(collection.semester)}${collection.subjectLabel}考古題（${collection.publisherLabel}版）`;
}

/** 例如「五上英語（康軒）」：相關連結、llms.txt 用的短名稱。 */
export function collectionShortLabel(collection: PastExamCollection): string {
  const term = `${gradeNumeral(collection.grade)}${collection.semester === 1 ? "上" : "下"}`;
  return `${term}${collection.subjectLabel}（${collection.publisherLabel}）`;
}

const EMPTY_STATE: PastExamsUrlState = {
  collectionId: null,
  academicYears: [],
  examType: null,
  city: null,
  query: "",
  examId: null,
  showAnswer: false,
};

/** 連到考古題工具頁，打開這個資料集（可再帶一份考卷或篩選）。 */
export function pastExamsToolHref(collection: PastExamCollection, patch: Partial<PastExamsUrlState> = {}): string {
  return `/past-exams?${writeUrlState({ ...EMPTY_STATE, collectionId: collection.id, ...patch })}`;
}

export interface CollectionSummary {
  collection: PastExamCollection;
  heading: string;
  /** 能開啟的考卷，照工具頁的順序。 */
  exams: PastExam[];
  groups: AcademicYearGroup[];
  answers: number;
  schools: number;
  /** 有考卷的縣市，份數多的在前；縣市未知的不列。 */
  cities: { city: string; count: number }[];
  /** 例如 ["114上", "113上"]，新到舊。 */
  academicYears: string[];
  /** 同年級同學期的其他資料集，給相關連結用。 */
  related: PastExamCollection[];
}

const collator = new Intl.Collator("zh-Hant");

export function summarizeCollection(catalog: PastExamCatalog, collectionId: string): CollectionSummary | null {
  const collection = catalog.datasets.find((dataset) => dataset.id === collectionId);
  if (!collection) return null;

  const exams = sortExams(catalog.exams.filter((exam) => exam.datasetId === collection.id && exam.available));
  const groups = groupByAcademicYear(exams);
  const cityCounts = new Map<string, number>();
  for (const exam of exams) {
    if (exam.city) cityCounts.set(exam.city, (cityCounts.get(exam.city) ?? 0) + 1);
  }
  return {
    collection,
    heading: collectionHeading(collection),
    exams,
    groups,
    answers: exams.filter((exam) => exam.answer !== null).length,
    schools: new Set(exams.filter((exam) => exam.school).map((exam) => `${exam.city ?? ""}|${exam.school}`)).size,
    cities: [...cityCounts]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || collator.compare(a.city, b.city)),
    academicYears: groups.map((group) => group.label),
    related: catalog.datasets.filter(
      (dataset) =>
        dataset.id !== collection.id && dataset.grade === collection.grade && dataset.semester === collection.semester,
    ),
  };
}

/** 落地頁的 meta description：份數、解答、學年度、縣市與學校數。 */
export function collectionDescription(summary: CollectionSummary): string {
  const { collection, exams, answers, academicYears, cities, schools } = summary;
  const term = `${gradeLabel(collection.grade)}${semesterLabel(collection.semester)}`;
  const answerText = answers > 0 ? `，其中 ${answers} 份附解答` : "";
  const years = academicYears.length > 0 ? `涵蓋 ${academicYears.join("、")} 學年度、` : "";
  return `收錄 ${exams.length} 份${term}${collection.subjectLabel}段考考卷（${collection.publisherLabel}版）${answerText}，${years}${cities.length} 個縣市 ${schools} 所國小。免費線上預覽 PDF、下載，也能匯入自製考卷練習。`;
}
