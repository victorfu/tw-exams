// 把 cowork 的 catalog（catalog-info.json＋catalog.jsonl，schema_version 1）精簡成頁面用的
// data/pastExams.json。同步腳本（Node 直接跑 TS）與測試共用，所以只能用可被型別剝除的語法，
// 也只能 `import type`。
import type { PastExam, PastExamCatalog, PastExamCollection, PastExamFormat, PastExamType } from "./types";

export const SUPPORTED_SCHEMA_VERSION = 1;

export interface CatalogInfoDataset {
  id: string;
  subject: string;
  subject_label: string;
  grade: number;
  semester: number;
  publisher: string;
  publisher_label: string;
  [key: string]: unknown;
}

export interface CatalogInfo {
  schema_version: number;
  generated_at: string;
  record_count: number;
  datasets: CatalogInfoDataset[];
  [key: string]: unknown;
}

export interface CatalogRecord {
  schema_version: number;
  record_id: string;
  dataset_id: string;
  title: string;
  academic_year_roc: number;
  academic_year_label: string;
  exam_type: string;
  exam_type_label: string;
  exam_round: number;
  period_label: string;
  city: string | null;
  school: string | null;
  question_file: {
    relative_path: string;
    format: string;
    downloaded: boolean;
    bytes: number | null;
    page_count: number | null;
    [key: string]: unknown;
  };
  search_text: string;
  [key: string]: unknown;
}

export class CatalogError extends Error {
  name = "CatalogError";
}

const FORMATS: Record<string, PastExamFormat> = { pdf: "pdf", doc: "word", docx: "word" };
const EXAM_TYPES: readonly string[] = ["midterm", "final"] satisfies PastExamType[];

/** 每行一筆 JSON；空行略過。解析失敗時報出行號（從 1 起算）。 */
export function parseCatalogJsonl(text: string): CatalogRecord[] {
  const records: CatalogRecord[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      records.push(JSON.parse(line) as CatalogRecord);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new CatalogError(`catalog.jsonl 第 ${index + 1} 行不是合法的 JSON：${reason}`);
    }
  });
  return records;
}

/** 以 `/` 分隔、不含 `.`／`..`／空段、不是絕對路徑，才不會跳出 output 根目錄。 */
export function isSafeRelativePath(path: unknown): path is string {
  if (typeof path !== "string" || path === "") return false;
  if (path.includes("\\") || path.includes(":")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function buildCatalog(info: CatalogInfo, records: readonly CatalogRecord[]): PastExamCatalog {
  if (info.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new CatalogError(
      `catalog-info.json 的 schema_version 是 ${info.schema_version}，只支援 ${SUPPORTED_SCHEMA_VERSION}`,
    );
  }
  if (info.record_count !== records.length) {
    throw new CatalogError(
      `catalog-info.json 的 record_count 是 ${info.record_count}，但 catalog.jsonl 有 ${records.length} 筆`,
    );
  }

  const datasets: PastExamCollection[] = info.datasets.map((dataset) => ({
    id: dataset.id,
    subject: dataset.subject,
    subjectLabel: dataset.subject_label,
    grade: dataset.grade,
    semester: dataset.semester,
    publisher: dataset.publisher,
    publisherLabel: dataset.publisher_label,
  }));
  const datasetIds = new Set(datasets.map((dataset) => dataset.id));
  const recordIds = new Set<string>();

  const exams = records.map((record, index): PastExam => {
    const where = `第 ${index + 1} 筆（${record.record_id}）`;
    if (record.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      throw new CatalogError(`${where} 的 schema_version 是 ${record.schema_version}，只支援 ${SUPPORTED_SCHEMA_VERSION}`);
    }
    // 頁面用 id 當清單的 key 與選取狀態，重複會選錯份。
    if (recordIds.has(record.record_id)) {
      throw new CatalogError(`${where} 的 record_id 與前面的紀錄重複`);
    }
    recordIds.add(record.record_id);
    if (!datasetIds.has(record.dataset_id)) {
      throw new CatalogError(`${where} 的資料集 ${record.dataset_id} 不在 catalog-info.json 裡`);
    }
    const file = record.question_file;
    if (!isSafeRelativePath(file.relative_path)) {
      throw new CatalogError(`${where} 的 relative_path ${JSON.stringify(file.relative_path)} 會跳出根目錄`);
    }
    const format = FORMATS[file.format];
    if (!format) {
      throw new CatalogError(`${where} 的檔案 format ${JSON.stringify(file.format)} 不支援`);
    }
    if (!EXAM_TYPES.includes(record.exam_type)) {
      throw new CatalogError(`${where} 的 exam_type ${JSON.stringify(record.exam_type)} 不支援`);
    }

    return {
      id: record.record_id,
      datasetId: record.dataset_id,
      academicYear: record.academic_year_roc,
      academicYearLabel: record.academic_year_label,
      examType: record.exam_type as PastExamType,
      examTypeLabel: record.exam_type_label,
      examRound: record.exam_round,
      periodLabel: record.period_label,
      city: record.city,
      school: record.school,
      title: record.title,
      file: file.relative_path,
      format,
      pages: file.page_count,
      bytes: file.bytes,
      available: file.downloaded,
      // cowork 已經把「臺」寫成「台」；這裡再折疊一次，頁面搜尋就不必每次重做。
      searchText: record.search_text.replaceAll("臺", "台"),
    };
  });

  return { generatedAt: info.generated_at, datasets, exams };
}
