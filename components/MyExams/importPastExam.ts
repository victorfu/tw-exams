import { MAX_SOURCE_PAGES, MAX_UPLOAD_FILE_BYTES, PAGE_LONG_EDGE_PX } from "../../constants/questionBank";
import { examFileUrl } from "../../lib/pastExams/fileUrl";
import type { PastExam, PastExamCollection } from "../../lib/pastExams/types";
import { createSource, newQuestionSourceId } from "../../services/questionSourceService";
import type { BankSubject } from "../../types/questionBank";
import { logger } from "../../utils/logger";
import {
  expandFilesToPages,
  PDF_ENGINE_FAILED_MESSAGE,
  releasePdfFiles,
  renderPage,
} from "../../utils/pageImageProcessor";

/** 考古題的科目代碼 → 題庫科目；不在表上的科目不能匯入。 */
const BANK_SUBJECT_BY_PAST_EXAM_SUBJECT: Record<string, BankSubject> = {
  chinese: "chinese",
  math: "math",
  science: "science",
  "social-studies": "social",
  english: "english",
};

export function bankSubjectOf(subject: string): BankSubject | null {
  return Object.hasOwn(BANK_SUBJECT_BY_PAST_EXAM_SUBJECT, subject) ? BANK_SUBJECT_BY_PAST_EXAM_SUBJECT[subject] : null;
}

/** 這份考卷能不能匯入：只收 PDF，科目也要是題庫有的。 */
export function canImportPastExam(exam: PastExam, collection: PastExamCollection): boolean {
  return exam.format === "pdf" && bankSubjectOf(collection.subject) !== null;
}

/** 題庫卡片與框題工具列上顯示的標題，例如「114上 臺北市 民權國小 期中考」。 */
export function pastExamSourceTitle(exam: PastExam): string {
  return [exam.academicYearLabel, exam.city, exam.school, exam.periodLabel].filter(Boolean).join(" ");
}

/** 匯入失敗；message 可以直接顯示給使用者。 */
export class PastExamImportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PastExamImportError";
  }
}

interface ImportPastExamOptions {
  exam: PastExam;
  collection: PastExamCollection;
  /** 展開頁數後先回報 (0, 總頁數)，之後每存好一頁回報一次。 */
  onProgress?: (done: number, total: number) => void;
  /** 中斷後不再 render 下一頁，已存的頁圖由 createSource 清掉；丟出的是 AbortError，不是 PastExamImportError。 */
  signal?: AbortSignal;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

async function downloadPdf(exam: PastExam, signal: AbortSignal | undefined): Promise<File> {
  let status: number;
  let blob: Blob | null = null;
  try {
    const response = await fetch(examFileUrl(exam.file), { signal, credentials: "same-origin" });
    status = response.status;
    if (response.ok) blob = await response.blob();
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    throw new PastExamImportError("無法下載考卷，請檢查網路後再試", { cause: error });
  }
  if (!blob) throw new PastExamImportError(`下載考卷失敗（HTTP ${status}），請稍後再試`);
  if (blob.size > MAX_UPLOAD_FILE_BYTES) throw new PastExamImportError("考卷檔超過 50MB，無法匯入");
  const name = exam.file.split("/").pop() || "exam.pdf";
  return new File([blob], /\.pdf$/i.test(name) ? name : `${name}.pdf`, { type: "application/pdf" });
}

/**
 * 把一份考古題 PDF 變成自製考卷的來源（跟「上傳題目」存的一樣），回傳新來源的 id。
 * 一次只 render 一頁；結束時（不論成功與否）釋放 PDF。
 */
export async function importPastExam({ exam, collection, onProgress, signal }: ImportPastExamOptions): Promise<string> {
  if (exam.format !== "pdf") throw new PastExamImportError("Word 檔無法匯入，只能匯入 PDF 考卷");
  const subject = bankSubjectOf(collection.subject);
  if (!subject) throw new PastExamImportError(`「${collection.subjectLabel}」還不能匯入自製考卷`);

  const file = await downloadPdf(exam, signal);
  let storedPages = 0;
  try {
    if (signal?.aborted) throw abortReason(signal);
    const { pages, errors } = await expandFilesToPages([file]);
    if (signal?.aborted) throw abortReason(signal);
    if (pages.length === 0) {
      const engineFailed = errors.some((error) => error.message === PDF_ENGINE_FAILED_MESSAGE);
      throw new PastExamImportError(engineFailed ? PDF_ENGINE_FAILED_MESSAGE : "考卷 PDF 無法讀取");
    }
    if (pages.length > MAX_SOURCE_PAGES) {
      throw new PastExamImportError(`考卷共 ${pages.length} 頁，超過自製考卷一次 ${MAX_SOURCE_PAGES} 頁的上限`);
    }

    const sourceId = newQuestionSourceId();
    onProgress?.(0, pages.length);
    await createSource({
      sourceId,
      title: pastExamSourceTitle(exam),
      subject,
      pageCount: pages.length,
      pastExam: {
        examId: exam.id,
        datasetId: exam.datasetId,
        examType: exam.examType,
        academicYear: exam.academicYear,
      },
      renderPage: async (index) => {
        if (signal?.aborted) throw abortReason(signal);
        const rendered = await renderPage(pages[index], PAGE_LONG_EDGE_PX);
        // 轉圖途中也可能取消；最後一頁沒有下一輪檢查，必須在保存前攔住。
        if (signal?.aborted) throw abortReason(signal);
        return rendered;
      },
      onProgress: (done, total) => {
        storedPages = done;
        onProgress?.(done, total);
      },
    });
    return sourceId;
  } catch (error) {
    if (error instanceof PastExamImportError || signal?.aborted) throw error;
    logger.warn("[importPastExam] page failed", exam.file, error);
    // 現在沒有網路步驟，會失敗的是在本機把某一頁轉成圖（解碼、canvas 記憶體不足）
    throw new PastExamImportError(`第 ${storedPages + 1} 頁處理失敗，請重試`, { cause: error });
  } finally {
    void releasePdfFiles([file]);
  }
}
