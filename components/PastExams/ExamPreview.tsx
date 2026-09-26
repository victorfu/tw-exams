"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FilePlus2, FileText, X } from "lucide-react";
import { downloadFileName } from "../../lib/pastExams/fileResponse";
import { examFileUrl } from "../../lib/pastExams/fileUrl";
import { UNKNOWN } from "../../lib/pastExams/filters";
import type { ExamFileRole, PastExam, PastExamCollection } from "../../lib/pastExams/types";
import { logger } from "../../utils/logger";
import { canImportPastExam, importPastExam, PastExamImportError } from "../MyExams/importPastExam";
import { PdfViewer } from "./PdfViewer";
import { SegmentButton } from "./SegmentButton";

interface ExamPreviewProps {
  exam: PastExam | null;
  /** 看題目卷或解答卷；沒有解答卷時一律是題目卷。 */
  view: ExamFileRole;
  onViewChange: (view: ExamFileRole) => void;
  /** 考卷所屬的資料集；匯入自製考卷時用它的科目。 */
  collection: PastExamCollection | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

/** PDF 用 pdf.js 畫在頁面上（桌機、手機相同）；Word 只能下載。有解答卷時可切換題目／解答。 */
export function ExamPreview({
  exam,
  view,
  onViewChange,
  collection,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: ExamPreviewProps) {
  const pastExamImport = usePastExamImport(exam, collection);

  if (!exam) {
    return (
      <div className="surface-card flex h-full flex-col items-center justify-center gap-3 rounded-xl p-6 text-center text-sm text-base-content/60">
        <FileText className="size-10 opacity-40" strokeWidth={1.5} aria-hidden="true" />
        <p>點左邊的考卷開始瀏覽，可用 ← → 切換</p>
      </div>
    );
  }

  const role: ExamFileRole = view === "answer" && exam.answer ? "answer" : "question";
  const shown = role === "answer" && exam.answer ? exam.answer : exam;
  const url = examFileUrl(shown.file);
  const downloadUrl = examFileUrl(shown.file, { download: true });
  const fileName = downloadFileName(exam, role);
  const iconButton = "btn btn-ghost btn-sm btn-square";

  return (
    <div className="surface-card flex h-full flex-col overflow-hidden md:rounded-xl">
      <header className="flex items-center gap-2 border-b border-border-hairline px-2 py-2 sm:px-3">
        <button type="button" className={`${iconButton} md:hidden`} aria-label="關閉預覽" onClick={onClose}>
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            {exam.school ?? UNKNOWN}
            <span className="ml-2 text-sm font-normal text-base-content/60">{exam.city ?? UNKNOWN}</span>
          </h2>
          <p className="truncate text-xs text-base-content/60">
            {exam.academicYearLabel} {exam.periodLabel}
            {shown.pages !== null && ` · ${shown.pages} 頁`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className={iconButton} aria-label="上一份" title="上一份（←）" disabled={!hasPrevious} onClick={onPrevious}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={iconButton} aria-label="下一份" title="下一份（→）" disabled={!hasNext} onClick={onNext}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          {shown.format === "pdf" && (
            <a href={url} target="_blank" rel="noopener" className={iconButton} aria-label="在新分頁開啟" title="在新分頁開啟">
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
          {collection && canImportPastExam(exam, collection) && (
            <ImportButton progress={pastExamImport.progress} onClick={pastExamImport.start} />
          )}
          <a href={downloadUrl} download={fileName} className="btn btn-sm" title={role === "answer" ? "下載解答" : "下載"}>
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">下載</span>
          </a>
        </div>
      </header>
      {exam.answer && (
        <div className="flex items-center border-b border-border-hairline px-2 py-1.5 sm:px-3">
          <div role="group" aria-label="題目或解答" className="join">
            <SegmentButton label="題目" pressed={role === "question"} onClick={() => onViewChange("question")} />
            <SegmentButton label="解答" pressed={role === "answer"} onClick={() => onViewChange("answer")} />
          </div>
        </div>
      )}
      {pastExamImport.error && (
        <p role="alert" className="border-b border-border-hairline px-3 py-2 text-sm text-error">
          {pastExamImport.error}
        </p>
      )}
      <div className="min-h-0 flex-1 bg-base-200">
        {shown.format === "pdf" ? (
          <PdfViewer url={url} title={role === "answer" ? `${exam.title}（解答）` : exam.title} />
        ) : (
          <FileNotice message="Word 檔無法在頁面內預覽，請下載後開啟。">
            <a href={downloadUrl} download={fileName} className="btn btn-primary btn-sm">
              <Download className="size-4" aria-hidden="true" />
              下載 Word 檔
            </a>
          </FileNotice>
        )}
      </div>
    </div>
  );
}

interface ImportProgress {
  done: number;
  /** 還在下載、展開 PDF 時是 0。 */
  total: number;
}

interface ImportState {
  examId: string;
  progress: ImportProgress | null;
  error: string | null;
}

/**
 * 把目前這份考卷匯入自製考卷，完成後跳到框題頁。
 * 換考卷或卸載時中斷進行中的匯入：不再跳頁，也不顯示它的結果。
 * 自製考卷的資料只在這個分頁的記憶體裡，所以一定要用 router.push，不能整頁重新載入。
 */
function usePastExamImport(exam: PastExam | null, collection: PastExamCollection | null) {
  const router = useRouter();
  const [state, setState] = useState<ImportState | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const examId = exam?.id ?? null;

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setState(null);
    },
    [examId],
  );

  const start = async () => {
    // ref 同步更新，連點兩下也只會匯入一次
    if (!exam || !collection || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const update = (next: Omit<ImportState, "examId">) => {
      if (!controller.signal.aborted) setState({ examId: exam.id, ...next });
    };
    update({ progress: { done: 0, total: 0 }, error: null });
    try {
      const sourceId = await importPastExam({
        exam,
        collection,
        signal: controller.signal,
        onProgress: (done, total) => update({ progress: { done, total }, error: null }),
      });
      if (controller.signal.aborted) return;
      router.push(`/my-exams/sources/${sourceId}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!(error instanceof PastExamImportError)) logger.error("[ExamPreview] import failed", error);
      update({ progress: null, error: error instanceof PastExamImportError ? error.message : "匯入失敗，請重試" });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const current = state?.examId === examId ? state : null;
  return { progress: current?.progress ?? null, error: current?.error ?? null, start: () => void start() };
}

function ImportButton({ progress, onClick }: { progress: ImportProgress | null; onClick: () => void }) {
  const counter = progress && progress.total > 0 ? `${progress.done}/${progress.total}` : "";
  const label = progress ? `匯入中${counter ? ` ${counter}` : "…"}` : "匯入自製考卷";
  return (
    <button
      type="button"
      data-import-exam
      className="btn btn-sm"
      aria-label={label}
      title={progress ? label : "匯入自製考卷，框出題目後就能組卷"}
      aria-busy={progress !== null}
      disabled={progress !== null}
      onClick={onClick}
    >
      {progress ? (
        <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      ) : (
        <FilePlus2 className="size-4" aria-hidden="true" />
      )}
      {/* 手機上只留圖示；匯入中仍顯示頁數進度 */}
      {progress && counter && <span className="sm:hidden">{counter}</span>}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FileNotice({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <FileText className="size-12 text-base-content/40" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-sm text-base-content/70">{message}</p>
      {children}
    </div>
  );
}
