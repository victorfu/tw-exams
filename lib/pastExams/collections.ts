import type { PastExamCollection } from "./types";

type CollectionKey = "grade" | "semester" | "subject" | "publisher";
export type CollectionChoice = Partial<Pick<PastExamCollection, CollectionKey>>;

/** 選擇列由上而下的優先順序：換年級時先保留學期，再保留科目，最後才是版本。 */
const KEYS: readonly CollectionKey[] = ["grade", "semester", "subject", "publisher"];

export interface CollectionOptions {
  /** 有任何資料的年級。 */
  grades: number[];
  /** 目前年級底下有資料的學期。 */
  semesters: number[];
  /** 目前年級、學期底下有資料的科目。 */
  subjects: string[];
  /** 目前年級、學期、科目底下的各版本。 */
  publishers: PastExamCollection[];
}

const unique = <T,>(values: T[]) => [...new Set(values)];

export function collectionOptions(
  datasets: readonly PastExamCollection[],
  current: PastExamCollection | null,
): CollectionOptions {
  const inGrade = datasets.filter((dataset) => dataset.grade === current?.grade);
  const inTerm = inGrade.filter((dataset) => dataset.semester === current?.semester);
  return {
    grades: unique(datasets.map((dataset) => dataset.grade)).sort((a, b) => a - b),
    semesters: unique(inGrade.map((dataset) => dataset.semester)).sort((a, b) => a - b),
    subjects: unique(inTerm.map((dataset) => dataset.subject)),
    publishers: inTerm.filter((dataset) => dataset.subject === current?.subject),
  };
}

/**
 * 改了選擇列的某一項之後要切到哪個資料集：一定符合改的那項，
 * 其餘依 KEYS 的順序盡量保留目前的選擇；都一樣時照目錄順序。沒有符合的回傳 null。
 */
export function pickCollection(
  datasets: readonly PastExamCollection[],
  current: PastExamCollection | null,
  change: CollectionChoice,
): PastExamCollection | null {
  const target = { ...current, ...change };
  // 不符合的項目依 KEYS 順序當成二進位位數：分數越小越接近目前的選擇。
  const distance = (dataset: PastExamCollection) =>
    KEYS.reduce((sum, key) => sum * 2 + (dataset[key] === target[key] ? 0 : 1), 0);
  let best: PastExamCollection | null = null;
  for (const dataset of datasets) {
    if (!KEYS.every((key) => change[key] === undefined || dataset[key] === change[key])) continue;
    if (best === null || distance(dataset) < distance(best)) best = dataset;
  }
  return best;
}
