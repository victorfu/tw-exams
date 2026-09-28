"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { pickRandomQuestions } from "./pickRandomQuestions";
import { resolveSheetQuestions } from "./sheetComposition";
import { SheetComposerForm } from "./SheetComposerForm";

function parsePracticeCount(value: string | null): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(100, Math.max(1, Math.floor(count))) : 20;
}

export default function SheetComposerPage() {
  const { id } = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const bank = useQuestionBank();

  const validBank = useMemo(() => {
    const sourceIds = new Set(bank.sources.map((source) => source.id));
    return bank.questions.filter((question) => sourceIds.has(question.sourceId));
  }, [bank.sources, bank.questions]);

  if (bank.loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
      </div>
    );
  }

  if (bank.error) {
    return (
      <div className="py-16 text-center">
        <p className="text-error">{bank.error}</p>
        <button type="button" className="btn btn-sm mt-4" onClick={bank.reload}>
          重試
        </button>
      </div>
    );
  }

  if (!id) {
    const practice = searchParams.get("practice") === "1";
    if (practice) {
      const datasetId = searchParams.get("datasetId");
      const examType = searchParams.get("type");
      const years = new Set(
        (searchParams.get("year") ?? "")
          .split(",")
          .filter((value) => /^\d+$/.test(value))
          .map(Number),
      );
      const sourceIds = new Set(
        bank.sources
          .filter((source) => {
            const meta = source.pastExam;
            return Boolean(
              meta &&
                datasetId &&
                meta.datasetId === datasetId &&
                (!examType || meta.examType === examType) &&
                (years.size === 0 || years.has(meta.academicYear)),
            );
          })
          .map((source) => source.id),
      );
      const practiceBank = validBank.filter((question) => sourceIds.has(question.sourceId));
      const requested = parsePracticeCount(searchParams.get("count"));
      const initialQuestions = pickRandomQuestions(practiceBank, requested);
      const title = searchParams.get("title")?.trim() || "考古題練習卷";
      return (
        <div className="space-y-4">
          {practiceBank.length < requested && (
            <div role="status" className="alert alert-warning mx-auto max-w-3xl">
              <span>
                目前符合條件、已框好的題目只有 {practiceBank.length} 題
                {practiceBank.length > 0 ? `，先用這 ${practiceBank.length} 題組卷。` : "。請先從考古題匯入並框出題目。"}
              </span>
              <Link href="/past-exams" className="btn btn-sm">回考古題</Link>
            </div>
          )}
          <SheetComposerForm
            key={`practice-${datasetId ?? "unknown"}-${examType ?? "all"}-${[...years].join("-")}-${requested}`}
            sheetId={null}
            initialTitle={title}
            initialQuestions={initialQuestions}
            missingCount={0}
            bank={practiceBank}
            sources={bank.sources.filter((source) => sourceIds.has(source.id))}
          />
        </div>
      );
    }

    return (
      <SheetComposerForm
        key="new"
        sheetId={null}
        initialTitle=""
        initialQuestions={[]}
        missingCount={0}
        bank={validBank}
        sources={bank.sources}
      />
    );
  }

  const sheet = bank.sheets.find((item) => item.id === id);
  if (!sheet) {
    return (
      <div className="py-16 text-center">
        <p className="text-base-content/70">找不到這份資料。</p>
        <Link href="/my-exams?tab=sheets" className="btn btn-sm mt-4">
          返回自製考卷
        </Link>
      </div>
    );
  }

  const { questions, missingCount } = resolveSheetQuestions(sheet.questionIds, validBank);
  return (
    <SheetComposerForm
      key={sheet.id}
      sheetId={sheet.id}
      initialTitle={sheet.title}
      initialQuestions={questions}
      missingCount={missingCount}
      bank={validBank}
      sources={bank.sources}
    />
  );
}
