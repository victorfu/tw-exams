"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FilePlus2, Upload } from "lucide-react";
import { latestSource, listHref, safeReturnTo, sourceEditorHref } from "./workspaceState";
import { useListScroll } from "./useListScroll";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { QuestionBankGrid } from "./QuestionBankGrid";
import { SheetList } from "./SheetList";
import { SourceList } from "./SourceList";
import { SourceUploadDialog } from "./SourceUploadDialog";

type MyExamsTab = "bank" | "sources" | "sheets";

const TABS: readonly { id: MyExamsTab; label: string }[] = [
  { id: "bank", label: "題庫" },
  { id: "sources", label: "來源檔案" },
  { id: "sheets", label: "我的考卷" },
];

function toTab(value: string | null): MyExamsTab {
  return value === "sources" || value === "sheets" ? value : "bank";
}

export default function MyExamsPage() {
  const searchParams = useSearchParams();
  const tab = toTab(searchParams.get("tab"));
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const bank = useQuestionBank();
  const sourceIds = new Set(bank.sources.map((source) => source.id));
  const validQuestions = bank.questions.filter((question) => sourceIds.has(question.sourceId));
  const usedSourceIds = new Set(validQuestions.map((question) => question.sourceId));
  const pendingCount = bank.sources.filter((source) => !usedSourceIds.has(source.id)).length;
  const latest = latestSource(bank.sources);
  const counts = { bank: validQuestions.length, sources: bank.sources.length, sheets: bank.sheets.length };
  const returnTo = safeReturnTo(listHref(new URLSearchParams(searchParams.toString())));
  useListScroll(returnTo, !bank.loading && !bank.error);
  const tabHref = (id: MyExamsTab) => {
    const next = new URLSearchParams(searchParams.toString());
    if (id === "bank") next.delete("tab"); else next.set("tab", id);
    return listHref(next);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">自製考卷</h1>
          <p className="text-sm text-base-content/60">匯入照片或 PDF，框選題目，再挑題組成考卷。</p>
        </div>
        {!bank.loading && !bank.error && <div className="flex flex-wrap gap-2">
          {validQuestions.length > 0 ? <Link href="/my-exams/sheets/new" className="btn btn-primary">
            <FilePlus2 className="size-4" />組新考卷
          </Link> : latest ? <Link href={sourceEditorHref(latest.id, returnTo)} className="btn btn-primary">開始框題</Link> : null}
          <button type="button" className={`btn ${!latest && validQuestions.length === 0 ? "btn-primary" : "btn-outline"}`} onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />匯入照片／PDF
          </button>
        </div>}

      </header>

      {/* 每個分頁留一筆瀏覽紀錄，上一頁才回得到前一個分頁；只換 query，不必捲回頂端 */}
      <div role="tablist" aria-label="自製考卷分類" className="tabs tabs-box w-fit max-w-full">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab min-w-0 px-2 text-xs sm:px-4 sm:text-sm ${tab === item.id ? "tab-active" : ""}`}
            onClick={() =>
              router.push(tabHref(item.id), { scroll: false })
            }
          >
            {item.label}{!bank.loading && !bank.error && `（${counts[item.id]}）`}
          </button>
        ))}
      </div>

      {!bank.loading && !bank.error && pendingCount > 0 && <Link href={tabHref("sources")} scroll={false} className="block rounded-xl border border-base-300 bg-base-100 p-3 text-sm text-primary hover:underline">
        尚有 {pendingCount} 份來源未框題 →
      </Link>}

      {bank.loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
        </div>
      ) : bank.error ? (
        <div role="alert" className="alert alert-error">
          <span>{bank.error}</span>
          <button type="button" className="btn btn-sm" onClick={bank.reload}>
            重試
          </button>
        </div>
      ) : tab === "bank" ? (
        <QuestionBankGrid sources={bank.sources} questions={bank.questions} onUpload={() => setUploadOpen(true)} />
      ) : tab === "sources" ? (
        <SourceList sources={bank.sources} questions={bank.questions} onDeleted={bank.reload} returnTo={returnTo} onUpload={() => setUploadOpen(true)} />
      ) : (
        bank.sheets.length === 0 && validQuestions.length === 0 ? <WorkspaceEmpty sources={bank.sources} onUpload={() => setUploadOpen(true)} returnTo={returnTo} /> :
        <SheetList sheets={bank.sheets} questions={bank.questions} sources={bank.sources} onDeleted={bank.reload} />
      )}

      <SourceUploadDialog
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(sourceId) => {
          setUploadOpen(false);
          router.push(sourceEditorHref(sourceId, returnTo));
        }}
      />
    </div>
  );
}
