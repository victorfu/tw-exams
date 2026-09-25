import type { PastExamCollection } from "./types";

export const GRADES = [1, 2, 3, 4, 5, 6] as const;
export const SEMESTERS = [1, 2] as const;

/** 科目固定清單（`metadata-format.md`）；還沒收錄的科目也要出現在選擇列。 */
export const SUBJECTS = [
  { id: "math", label: "數學" },
  { id: "chinese", label: "國語" },
  { id: "english", label: "英文" },
  { id: "science", label: "自然" },
  { id: "social-studies", label: "社會" },
] as const;

const NUMERALS = ["一", "二", "三", "四", "五", "六"];

/** 例如 5 →「五」。 */
export function gradeNumeral(grade: number): string {
  return NUMERALS[grade - 1] ?? String(grade);
}

export function gradeLabel(grade: number): string {
  return `${gradeNumeral(grade)}年級`;
}

export function semesterLabel(semester: number): string {
  return semester === 1 ? "上學期" : "下學期";
}

/** 例如「五年級 上學期」。 */
export function termLabel(grade: number, semester: number): string {
  return `${gradeLabel(grade)} ${semesterLabel(semester)}`;
}

/** 優先用資料集的 subjectLabel，其次是固定清單，都沒有就顯示原值。 */
export function subjectLabel(subject: string, datasets: readonly PastExamCollection[]): string {
  return (
    datasets.find((dataset) => dataset.subject === subject)?.subjectLabel ??
    SUBJECTS.find((item) => item.id === subject)?.label ??
    subject
  );
}
