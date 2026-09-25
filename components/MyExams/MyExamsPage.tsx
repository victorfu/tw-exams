"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FilePlus2, Upload } from "lucide-react";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { QuestionBankGrid } from "./QuestionBankGrid";
import { SheetList } from "./SheetList";
import { SourceList } from "./SourceList";
import { SourceUploadDialog } from "./SourceUploadDialog";

type MyExamsTab = "bank" | "sources" | "sheets";

const TABS: readonly { id: MyExamsTab; label: string }[] = [
  { id: "bank", label: "題庫" },
  { id: "sources", label: "上傳紀錄" },
  { id: "sheets", label: "考卷" },
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">自製考卷</h1>
          <p className="text-sm text-base-content/60">上傳照片或 PDF，框出題目，組成考卷印出來。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/my-exams/sheets/new" className="btn btn-sm">
            <FilePlus2 className="size-4" />
            組新考卷
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            上傳題目
          </button>
        </div>
      </header>

      {/* 每個分頁留一筆瀏覽紀錄，上一頁才回得到前一個分頁；只換 query，不必捲回頂端 */}
      <div role="tablist" className="tabs tabs-box w-fit">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab ${tab === item.id ? "tab-active" : ""}`}
            onClick={() =>
              router.push(item.id === "bank" ? "/my-exams" : `/my-exams?tab=${item.id}`, { scroll: false })
            }
          >
            {item.label}
          </button>
        ))}
      </div>

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
        <SourceList sources={bank.sources} questions={bank.questions} onDeleted={bank.reload} />
      ) : (
        <SheetList sheets={bank.sheets} questions={bank.questions} sources={bank.sources} onDeleted={bank.reload} />
      )}

      <SourceUploadDialog
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(sourceId) => {
          setUploadOpen(false);
          router.push(`/my-exams/sources/${sourceId}`);
        }}
      />
    </div>
  );
}
