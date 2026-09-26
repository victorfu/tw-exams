"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from "lucide-react";
import { downloadFileName } from "../../lib/pastExams/fileResponse";
import { examFileUrl } from "../../lib/pastExams/fileUrl";
import { UNKNOWN } from "../../lib/pastExams/filters";
import type { PastExam } from "../../lib/pastExams/types";
import { PdfViewer } from "./PdfViewer";

interface ExamPreviewProps {
  exam: PastExam | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

/** PDF 用 pdf.js 畫在頁面上（桌機、手機相同）；Word 只能下載。 */
export function ExamPreview({ exam, hasPrevious, hasNext, onPrevious, onNext, onClose }: ExamPreviewProps) {
  if (!exam) {
    return (
      <div className="surface-card flex h-full flex-col items-center justify-center gap-3 rounded-xl p-6 text-center text-sm text-base-content/60">
        <FileText className="size-10 opacity-40" strokeWidth={1.5} aria-hidden="true" />
        <p>點左邊的考卷開始瀏覽，可用 ← → 切換</p>
      </div>
    );
  }

  const url = examFileUrl(exam.file);
  const downloadUrl = examFileUrl(exam.file, { download: true });
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
            {exam.pages !== null && ` · ${exam.pages} 頁`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className={iconButton} aria-label="上一份" title="上一份（←）" disabled={!hasPrevious} onClick={onPrevious}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={iconButton} aria-label="下一份" title="下一份（→）" disabled={!hasNext} onClick={onNext}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          {exam.format === "pdf" && (
            <a href={url} target="_blank" rel="noopener noreferrer" className={iconButton} aria-label="在新分頁開啟" title="在新分頁開啟">
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
          <a href={downloadUrl} download={downloadFileName(exam)} className="btn btn-sm" title="下載">
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">下載</span>
          </a>
        </div>
      </header>
      <div className="min-h-0 flex-1 bg-base-200">
        {exam.format === "pdf" ? (
          <PdfViewer url={url} title={exam.title} />
        ) : (
          <FileNotice message="Word 檔無法在頁面內預覽，請下載後開啟。">
            <a href={downloadUrl} download={downloadFileName(exam)} className="btn btn-primary btn-sm">
              <Download className="size-4" aria-hidden="true" />
              下載 Word 檔
            </a>
          </FileNotice>
        )}
      </div>
    </div>
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
