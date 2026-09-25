/** 考卷檔的呈現方式：PDF 可在頁面內預覽，Word（.doc／.docx）只能下載。 */
export type PastExamFormat = "pdf" | "word";

export type PastExamType = "midterm" | "final";

/** 一個資料集：科目 × 年級 × 學期 × 版本。 */
export interface PastExamCollection {
  id: string;
  subject: string;
  subjectLabel: string;
  grade: number;
  semester: number;
  publisher: string;
  publisherLabel: string;
}

export interface PastExam {
  id: string;
  datasetId: string;
  /** 民國學年度，例如 114。 */
  academicYear: number;
  /** 例如「114上」。 */
  academicYearLabel: string;
  examType: PastExamType;
  examTypeLabel: string;
  examRound: number;
  /** 例如「期末2」。 */
  periodLabel: string;
  city: string | null;
  school: string | null;
  title: string;
  /** 以 cowork 的 `output/` 為基準的相對路徑，也是 `public/exams/` 底下的路徑。 */
  file: string;
  format: PastExamFormat;
  pages: number | null;
  bytes: number | null;
  /** 檔案已下載，可以預覽或下載。 */
  available: boolean;
  /** cowork 已正規化過的搜尋字串（NFKC、小寫、臺→台、年級別名）。 */
  searchText: string;
}

/** `data/pastExams.json` 的內容。 */
export interface PastExamCatalog {
  generatedAt: string;
  datasets: PastExamCollection[];
  exams: PastExam[];
}
