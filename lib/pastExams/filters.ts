import type { PastExam, PastExamType } from "./types";

/** 縣市或學校未知（catalog 裡是 null）時的顯示文字，也是縣市篩選的值。 */
export const UNKNOWN = "未知";

export interface ExamFilters {
  datasetId?: string | null;
  academicYears?: readonly number[];
  examType?: PastExamType | null;
  city?: string | null;
  query?: string;
}

export interface AcademicYearGroup {
  academicYear: number;
  label: string;
  exams: PastExam[];
}

export interface FacetValues {
  academicYears: { value: number; label: string }[];
  cities: string[];
}

const collator = new Intl.Collator("zh-Hant");
const EXAM_TYPE_ORDER: Record<PastExamType, number> = { midterm: 0, final: 1 };

/**
 * 與 cowork 的 search_text 相同的正規化：NFKC、小寫、臺→台，再以空白切詞。
 * searchText 的「臺」在同步時（buildCatalog）已經折疊成「台」，所以哪種寫法都找得到。
 */
export function normalizeQuery(query: string): string[] {
  return query.normalize("NFKC").toLowerCase().replaceAll("臺", "台").split(/\s+/).filter(Boolean);
}

/** 篩選值為空（null、空陣列、空字串）代表不限；搜尋詞全部都要出現在 searchText。 */
export function filterExams(exams: readonly PastExam[], filters: ExamFilters): PastExam[] {
  const terms = normalizeQuery(filters.query ?? "");
  const years = filters.academicYears ?? [];
  return exams.filter(
    (exam) =>
      (!filters.datasetId || exam.datasetId === filters.datasetId) &&
      (years.length === 0 || years.includes(exam.academicYear)) &&
      (!filters.examType || exam.examType === filters.examType) &&
      (!filters.city || (exam.city ?? UNKNOWN) === filters.city) &&
      terms.every((term) => exam.searchText.includes(term)),
  );
}

function compareNullable(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return collator.compare(a, b);
}

/** 學年度新到舊 → 期中先於期末 → 段考次序 → 縣市、學校（未知排最後）。 */
export function sortExams(exams: readonly PastExam[]): PastExam[] {
  return [...exams].sort(
    (a, b) =>
      b.academicYear - a.academicYear ||
      EXAM_TYPE_ORDER[a.examType] - EXAM_TYPE_ORDER[b.examType] ||
      a.examRound - b.examRound ||
      compareNullable(a.city, b.city) ||
      compareNullable(a.school, b.school) ||
      a.id.localeCompare(b.id),
  );
}

/** 把已排序的清單依學年度切段（相鄰同年度的歸同一段）。 */
export function groupByAcademicYear(exams: readonly PastExam[]): AcademicYearGroup[] {
  const groups: AcademicYearGroup[] = [];
  for (const exam of exams) {
    const last = groups.at(-1);
    if (last && last.academicYear === exam.academicYear) last.exams.push(exam);
    else groups.push({ academicYear: exam.academicYear, label: exam.academicYearLabel, exams: [exam] });
  }
  return groups;
}

/** 可選的學年度（新到舊）與縣市（排序後，未知放最後）。 */
export function facetValues(exams: readonly PastExam[]): FacetValues {
  const years = new Map<number, string>();
  const cities = new Set<string>();
  let hasUnknownCity = false;
  for (const exam of exams) {
    if (!years.has(exam.academicYear)) years.set(exam.academicYear, exam.academicYearLabel);
    if (exam.city === null) hasUnknownCity = true;
    else cities.add(exam.city);
  }
  return {
    academicYears: [...years]
      .sort(([a], [b]) => b - a)
      .map(([value, label]) => ({ value, label })),
    cities: [...[...cities].sort(collator.compare), ...(hasUnknownCity ? [UNKNOWN] : [])],
  };
}
