"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import Link from "next/link";
import type { BankQuestion, QuestionSource } from "../../types/questionBank";
import { BANK_SUBJECT_LABELS } from "../../types/questionBank";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { QuestionCrop } from "./QuestionCrop";
import { sourceEditorHref } from "./workspaceState";

export function QuestionPreview({ question, source, number, returnTo, returnFocus, onClose }: {
  question: BankQuestion;
  source: QuestionSource;
  number: number;
  returnTo: string;
  returnFocus: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const { urls, refresh } = useSignedPageUrls(question.regions.flatMap((region) => {
    const page = source.pages[region.pageIndex];
    return page ? [page.storagePath] : [];
  }));
  useEffect(() => {
    const dialog = ref.current;
    const trigger = returnFocus.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return (
    <dialog ref={ref} aria-labelledby={heading}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto h-dvh max-h-dvh w-full max-w-none overflow-hidden bg-base-100 p-0 text-base-content backdrop:bg-black/45 sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-2xl">
      <div className="flex h-full max-h-dvh flex-col sm:max-h-[90dvh]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-base-300 p-4">
          <div className="min-w-0">
            <h2 id={heading} className="font-semibold">第 {number} 題・{BANK_SUBJECT_LABELS[question.subject]}</h2>
            <p className="break-words text-sm text-base-content/65">{source.title}</p>
            <p className="text-xs text-base-content/65">第 {[...new Set(question.regions.map((region) => region.pageIndex + 1))].join("、")} 頁</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={onClose} autoFocus>關閉預覽</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-base-200 p-4 sm:p-6">
          <QuestionCrop regions={question.regions} pages={source.pages} urls={urls} loading="eager" layout={{ kind: "fill" }} onRetry={(path) => void refresh(path)} />
        </div>
        <footer className="shrink-0 border-t border-base-300 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-right">
          <Link href={sourceEditorHref(source.id, returnTo, question.id)} className="btn btn-primary">編輯題目</Link>
        </footer>
      </div>
    </dialog>
  );
}
