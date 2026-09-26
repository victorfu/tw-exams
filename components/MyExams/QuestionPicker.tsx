"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import {
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  type BankQuestion,
  type BankSubject,
  type QuestionSource,
} from "../../types/questionBank";
import { orderBankQuestions, sortQuestionsInSource } from "./questionOrdering";
import { QuestionCrop } from "./QuestionCrop";

interface QuestionPickerProps {
  isOpen: boolean;
  bank: readonly BankQuestion[];
  sources: readonly QuestionSource[];
  excludeIds: ReadonlySet<string>;
  onAdd: (questions: BankQuestion[]) => void;
  onClose: () => void;
}

export function QuestionPicker({ isOpen, bank, sources, excludeIds, onAdd, onClose }: QuestionPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [filter, setFilter] = useState<BankSubject | "all">("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const candidates = useMemo(
    () =>
      orderBankQuestions(bank, sources).filter(
        (question) => !excludeIds.has(question.id) && sourceById.has(question.sourceId),
      ),
    [bank, sources, excludeIds, sourceById],
  );
  // 題號與框選頁的「第 N 題」一致：來源內依框選順序，含已在考卷上的題目
  const numberById = useMemo(() => {
    const bySource = new Map<string, BankQuestion[]>();
    for (const question of bank) {
      const group = bySource.get(question.sourceId);
      if (group) group.push(question);
      else bySource.set(question.sourceId, [question]);
    }
    const numbers = new Map<string, number>();
    for (const group of bySource.values()) {
      sortQuestionsInSource(group).forEach((question, index) => numbers.set(question.id, index + 1));
    }
    return numbers;
  }, [bank]);
  const visible = useMemo(
    () => (filter === "all" ? candidates : candidates.filter((question) => question.subject === filter)),
    [candidates, filter],
  );
  const paths = isOpen
    ? visible.flatMap((question) =>
        question.regions.flatMap((region) => {
          const page = sourceById.get(question.sourceId)?.pages[region.pageIndex];
          return page ? [page.storagePath] : [];
        }),
      )
    : [];
  const { urls, refresh } = useSignedPageUrls(paths);

  const toggle = useCallback(
    (id: string) =>
      setSelected((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const close = () => {
    setSelected(new Set());
    setFilter("all");
    onClose();
  };

  const add = () => {
    onAdd(candidates.filter((question) => selected.has(question.id)));
    setSelected(new Set());
    setFilter("all");
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="modal-box max-w-3xl">
        <h3 id={headingId} className="text-lg font-semibold">
          加入指定題目
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", ...BANK_SUBJECTS] as const).map((subject) => (
            <button
              key={subject}
              type="button"
              aria-pressed={filter === subject}
              className={`btn btn-sm rounded-full ${filter === subject ? "btn-primary" : "btn-ghost border border-base-300"}`}
              onClick={() => setFilter(subject)}
            >
              {subject === "all" ? "全部" : BANK_SUBJECT_LABELS[subject]}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-base-content/60">沒有可以加入的題目。</p>
        ) : (
          <PickerCards
            questions={visible}
            sourceById={sourceById}
            numberById={numberById}
            selected={selected}
            urls={urls}
            onToggle={toggle}
            onRetry={refresh}
          />
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            取消
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={selected.size === 0} onClick={add}>
            加入 {selected.size} 題
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface PickerCardsProps {
  questions: readonly BankQuestion[];
  sourceById: ReadonlyMap<string, QuestionSource>;
  numberById: ReadonlyMap<string, number>;
  selected: ReadonlySet<string>;
  urls: Readonly<Record<string, string>>;
  onToggle: (id: string) => void;
  onRetry: (storagePath: string) => Promise<void>;
}

// 組卷頁每打一個字都會重新渲染挑題視窗（關著時也一樣），題庫可能有好幾百題：
// memo 起來，題目、勾選或圖片網址沒變就不重畫卡片。
// 關著時也不卸載卡片，否則關閉動畫還在播時對話框會先縮成只剩標題。
const PickerCards = memo(function PickerCards({
  questions,
  sourceById,
  numberById,
  selected,
  urls,
  onToggle,
  onRetry,
}: PickerCardsProps) {
  return (
    <ul className="mt-4 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
      {questions.map((question) => {
        const source = sourceById.get(question.sourceId);
        if (!source) return null;
        const checked = selected.has(question.id);
        return (
          <li key={question.id}>
            {/* 圖片載入失敗時 QuestionCrop 會放「重試」按鈕，不能包在切換按鈕裡；
                切換按鈕只包文字，再用 ::after 撐滿整張卡片當點擊範圍 */}
            <div
              className={`relative flex h-full w-full flex-col items-center gap-2 rounded-lg border-2 bg-base-100 p-2 ${
                checked ? "border-primary" : "border-base-300"
              }`}
            >
              {checked && (
                <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-content">
                  <Check className="size-3" />
                </span>
              )}
              <QuestionCrop
                regions={question.regions}
                pages={source.pages}
                urls={urls}
                loading="lazy"
                layout={{ kind: "thumbnail", maxHeightPx: 120 }}
                onRetry={(path) => void onRetry(path)}
              />
              <button
                type="button"
                data-question-id={question.id}
                aria-pressed={checked}
                className="w-full text-left text-xs text-base-content/60 after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
                onClick={() => onToggle(question.id)}
              >
                <span className="block truncate">
                  {BANK_SUBJECT_LABELS[question.subject]}・{source.title}
                </span>
                {/* 同一份上傳、同科目的卡片文字都一樣，補上題號讓報讀出來的名稱可以區分 */}
                <span className="sr-only">・第 {numberById.get(question.id)} 題</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
});
