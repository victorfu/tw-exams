"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { BANK_SUBJECTS, BANK_SUBJECT_LABELS, isBankSubject, type BankQuestion, type QuestionSource } from "../../types/questionBank";
import { orderBankQuestions, sortQuestionsInSource } from "./questionOrdering";
import { QuestionCrop } from "./QuestionCrop";
import { QuestionPreview } from "./QuestionPreview";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { clearSelection, createSelectionDraft, exitSelection, listHref, safeReturnTo, startSelection, toggleQuestion, useWorkspaceSelection } from "./workspaceState";

interface QuestionBankGridProps {
  sources: readonly QuestionSource[];
  questions: readonly BankQuestion[];
  onUpload: () => void;
}

export function QuestionBankGrid({ sources, questions, onUpload }: QuestionBankGridProps) {
  const router = useRouter();
  const params = useSearchParams();
  const subjectValue = params.get("subject") ?? "";
  const subject = isBankSubject(subjectValue) ? subjectValue : "all";
  const sourceFilter = sources.some((source) => source.id === params.get("source")) ? params.get("source")! : "";
  const search = params.get("search") ?? "";
  const returnTo = safeReturnTo(listHref(new URLSearchParams(params.toString())));
  const selection = useWorkspaceSelection();
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const ordered = useMemo(() => orderBankQuestions(questions, sources).filter((question) => sourceById.has(question.sourceId)), [questions, sources, sourceById]);
  const numbers = useMemo(() => {
    const result = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const question of sortQuestionsInSource(questions)) {
      const number = (counts.get(question.sourceId) ?? 0) + 1;
      counts.set(question.sourceId, number);
      result.set(question.id, number);
    }
    return result;
  }, [questions]);
  const needle = search.trim().toLocaleLowerCase();
  const visible = ordered.filter((question) =>
    (subject === "all" || question.subject === subject) &&
    (!sourceFilter || question.sourceId === sourceFilter) &&
    (!needle || sourceById.get(question.sourceId)!.title.toLocaleLowerCase().includes(needle)),
  );
  const validIds = new Set(ordered.map((question) => question.id));
  const selectedIds = selection.ids.filter((id) => validIds.has(id));
  const selected = new Set(selectedIds);
  const visibleIds = new Set(visible.map((question) => question.id));
  const hiddenCount = selectedIds.filter((id) => !visibleIds.has(id)).length;
  const paths = visible.flatMap((question) => question.regions.flatMap((region) => {
    const page = sourceById.get(question.sourceId)?.pages[region.pageIndex];
    return page ? [page.storagePath] : [];
  }));
  const { urls, refresh } = useSignedPageUrls(paths);
  const preview = ordered.find((question) => question.id === previewId);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(listHref(next), { scroll: false });
  }
  function clearFilters() {
    const next = new URLSearchParams(params.toString());
    for (const key of ["subject", "source", "search"]) next.delete(key);
    router.replace(listHref(next), { scroll: false });
  }

  if (ordered.length === 0) return <WorkspaceEmpty sources={sources} onUpload={onUpload} returnTo={returnTo} />;

  return (
    <div className={`space-y-5 ${selection.active ? "pb-44 sm:pb-28" : ""}`}>
      <div className="space-y-3 rounded-2xl border border-base-300 bg-base-100 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            搜尋來源名稱
            <input type="search" className="input w-full" value={search} placeholder="例如：四上數學月考" onChange={(event) => updateFilter("search", event.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:w-56">
            來源檔案
            <select className="select w-full" value={sourceFilter} onChange={(event) => updateFilter("source", event.target.value)}>
              <option value="">全部來源</option>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="科目篩選">
          {["all", ...BANK_SUBJECTS].map((item) => (
            <button key={item} type="button" aria-pressed={subject === item} className={`btn btn-sm rounded-full ${subject === item ? "btn-primary" : "btn-ghost border border-base-300"}`}
              onClick={() => updateFilter("subject", item === "all" ? "" : item)}>
              {item === "all" ? "全部" : BANK_SUBJECT_LABELS[item as keyof typeof BANK_SUBJECT_LABELS]} {item === "all" ? ordered.length : ordered.filter((question) => question.subject === item).length}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-base-content/65" role="status">顯示 {visible.length} 題，共 {ordered.length} 題</p>
        {!selection.active && <button type="button" className="btn btn-outline btn-sm" onClick={startSelection}>選題模式</button>}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-8 text-center">
          <p>目前科目、來源與搜尋條件沒有符合的題目。</p>
          <button type="button" className="btn btn-sm mt-4" onClick={clearFilters}>清除篩選</button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((question) => {
            const source = sourceById.get(question.sourceId)!;
            const number = numbers.get(question.id)!;
            return (
              <li key={question.id}>
                <article className={`relative flex h-full flex-col rounded-2xl border bg-base-100 p-4 transition-colors ${selected.has(question.id) ? "border-primary ring-1 ring-primary" : "border-base-300 hover:border-primary"}`}>
                  {selection.active && <label className="relative z-10 mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(question.id)} onChange={() => toggleQuestion(question.id)} aria-label={`選取 ${source.title} 第 ${number} 題`} />
                    {selected.has(question.id) ? "已選取" : "選取題目"}
                  </label>}
                  <div className="flex min-h-32 flex-1 items-start justify-center">
                    <QuestionCrop regions={question.regions} pages={source.pages} urls={urls} loading="lazy" layout={{ kind: "thumbnail", maxHeightPx: 240 }} onRetry={(path) => void refresh(path)} />
                  </div>
                  <div className="mt-4 space-y-2 border-t border-base-200 pt-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="badge badge-ghost badge-sm">{BANK_SUBJECT_LABELS[question.subject]}</span>
                      <span>第 {number} 題</span>
                      <span className="text-xs text-base-content/65">第 {[...new Set(question.regions.map((region) => region.pageIndex + 1))].join("、")} 頁</span>
                    </div>
                    <p className="break-words text-sm text-base-content/65">{source.title}</p>
                    <button type="button" className={`btn btn-ghost btn-sm ${selection.active ? "relative z-10" : "after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-primary"}`}
                      aria-label={`預覽 ${source.title} 第 ${number} 題`} onClick={(event) => { previewTrigger.current = event.currentTarget; setPreviewId(question.id); }}>預覽題目</button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {selection.active && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-base-300 bg-base-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg md:left-20">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <p className="mr-auto text-sm" role="status">已選 {selectedIds.length} 題{hiddenCount > 0 && <span className="block text-xs text-base-content/65">其中 {hiddenCount} 題未顯示在目前篩選中</span>}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={selection.ids.length === 0}>清除選取</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exitSelection}>退出選題</button>
            <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={selectedIds.length === 0} onClick={() => {
              const token = createSelectionDraft(selectedIds, returnTo);
              router.push(`/my-exams/sheets/new?selection=${encodeURIComponent(token)}`);
            }}>用這些題目組卷</button>
          </div>
        </div>
      )}
      {preview && <QuestionPreview key={preview.id} question={preview} source={sourceById.get(preview.sourceId)!} number={numbers.get(preview.id)!} returnTo={returnTo} returnFocus={previewTrigger} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
