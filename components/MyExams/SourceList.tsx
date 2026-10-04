"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "../common/ConfirmModal";
import { deleteSource } from "../../services/questionSourceService";
import {
  BANK_SUBJECT_LABELS,
  type BankQuestion,
  type QuestionSource,
} from "../../types/questionBank";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { QuestionCrop } from "./QuestionCrop";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { sourceEditorHref } from "./workspaceState";
import { logger } from "../../utils/logger";

interface SourceListProps {
  sources: readonly QuestionSource[];
  questions: readonly BankQuestion[];
  onDeleted: () => void;
  returnTo?: string;
  onUpload: () => void;
}

export function SourceList({ sources, questions, onDeleted, returnTo = "/my-exams?tab=sources", onUpload }: SourceListProps) {
  const { urls, refresh } = useSignedPageUrls(sources.flatMap((source) => source.pages[0] ? [source.pages[0].storagePath] : []));
  const [target, setTarget] = useState<QuestionSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of questions) {
      counts.set(question.sourceId, (counts.get(question.sourceId) ?? 0) + 1);
    }
    return counts;
  }, [questions]);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSource(target);
      setTarget(null);
      onDeleted();
    } catch (deleteError) {
      logger.error("[SourceList] delete failed", deleteError);
      setError("刪除失敗，請再按一次刪除");
    } finally {
      setDeleting(false);
    }
  };

  if (sources.length === 0) {
    return <WorkspaceEmpty sources={sources} onUpload={onUpload} returnTo={returnTo} />;
  }

  return (
    <>
      <ul className="divide-y divide-base-300 rounded-lg border border-base-300 bg-base-100">
        {sources.map((source) => (
          <li key={source.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="w-16 shrink-0 sm:w-20">
              {source.pages[0] && <QuestionCrop regions={[{ pageIndex: 0, box: { x: 0, y: 0, w: 1, h: 1 } }]} pages={source.pages} urls={urls} loading="lazy" layout={{ kind: "thumbnail", maxHeightPx: 96 }} onRetry={(path) => void refresh(path)} />}
            </div>
            <Link href={sourceEditorHref(source.id, returnTo)} className="min-w-0 flex-1 basis-[calc(100%-5rem)] sm:basis-0">
              <p className="break-words font-medium">{source.title}</p>
              {!countBySource.get(source.id) && <span className="badge badge-warning badge-sm my-1">尚未框題</span>}
              <p className="text-sm text-base-content/60">
                {BANK_SUBJECT_LABELS[source.subject]}・{source.pages.length} 頁・
                {countBySource.get(source.id) ?? 0} 題・{source.createdAt.toLocaleDateString("zh-TW")}
              </p>
            </Link>
            <Link href={sourceEditorHref(source.id, returnTo)} className="btn btn-outline btn-sm ml-auto sm:ml-0">
              {countBySource.get(source.id) ? "繼續框題" : "開始框題"}
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              aria-label={`刪除 ${source.title}`}
              onClick={() => {
                setError(null);
                setTarget(source);
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        isOpen={target !== null}
        title="刪除這次上傳？"
        message={
          target
            ? `「${target.title}」的 ${countBySource.get(target.id) ?? 0} 題和所有頁面圖都會刪除，無法復原。`
            : ""
        }
        confirmText="刪除"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setTarget(null)}
        isLoading={deleting}
        errorMessage={error}
      />
    </>
  );
}
