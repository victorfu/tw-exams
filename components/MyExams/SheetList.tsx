"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { ConfirmModal } from "../common/ConfirmModal";
import { deleteSheet } from "../../services/examSheetService";
import type { BankQuestion, ExamSheet, QuestionSource } from "../../types/questionBank";
import { logger } from "../../utils/logger";

interface SheetListProps {
  sheets: readonly ExamSheet[];
  questions: readonly BankQuestion[];
  sources: readonly QuestionSource[];
  onDeleted: () => void;
}

export function SheetList({ sheets, questions, sources, onDeleted }: SheetListProps) {
  const [target, setTarget] = useState<ExamSheet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 考卷存的 id 不會跟著題目刪除；跟列印、編輯一樣只算題庫裡還找得到（且來源還在）的題目
  const availableIds = useMemo(() => {
    const sourceIds = new Set(sources.map((source) => source.id));
    return new Set(
      questions.filter((question) => sourceIds.has(question.sourceId)).map((question) => question.id),
    );
  }, [questions, sources]);

  const countLabel = (sheet: ExamSheet) => {
    const count = sheet.questionIds.filter((id) => availableIds.has(id)).length;
    const missingCount = sheet.questionIds.length - count;
    return { count, missingCount };
  };

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSheet(target.id);
      setTarget(null);
      onDeleted();
    } catch (deleteError) {
      logger.error("[SheetList] delete failed", deleteError);
      setError("刪除失敗，請重試");
    } finally {
      setDeleting(false);
    }
  };

  if (sheets.length === 0) {
    return <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
      <p className="text-base-content/65">還沒有考卷。從題庫挑選題目，或設定科目隨機抽題。</p>
      <Link href="/my-exams/sheets/new" className="btn btn-primary mt-4">組第一份考卷</Link>
    </div>;
  }

  return (
    <>
      <ul className="divide-y divide-base-300 rounded-lg border border-base-300 bg-base-100">
        {sheets.map((sheet) => (
          <li key={sheet.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{sheet.title}</p>
              <p className="text-sm text-base-content/60">
                {sheet.createdAt.toLocaleDateString("zh-TW")}・{countLabel(sheet).count} 題
              </p>
              {countLabel(sheet).missingCount > 0 && <span className="badge badge-warning badge-sm mt-2">{countLabel(sheet).missingCount} 題已刪除</span>}
            </div>
            <Link href={`/my-exams/sheets/${sheet.id}/print`} className="btn btn-sm">
              <Printer className="size-4" />
              列印
            </Link>
            <Link href={`/my-exams/sheets/${sheet.id}/edit`} className="btn btn-ghost btn-sm">
              <Pencil className="size-4" />
              {countLabel(sheet).missingCount > 0 ? "編輯補題" : "編輯"}
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              aria-label={`刪除 ${sheet.title}`}
              onClick={() => {
                setError(null);
                setTarget(sheet);
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        isOpen={target !== null}
        title="刪除這張考卷？"
        message={target ? `「${target.title}」會被刪除，題庫裡的題目不受影響。` : ""}
        confirmText="刪除"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setTarget(null)}
        isLoading={deleting}
        errorMessage={error}
      />
    </>
  );
}
