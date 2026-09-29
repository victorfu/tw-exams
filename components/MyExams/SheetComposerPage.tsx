"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { pickRandomQuestions } from "./pickRandomQuestions";
import { practiceQuestionPool, readPracticeSheetRequest } from "./practiceSheet";
import { resolveSheetQuestions } from "./sheetComposition";
import { SheetComposerForm } from "./SheetComposerForm";

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
    const practice = readPracticeSheetRequest(searchParams);
    if (practice) {
      const pool = practiceQuestionPool(bank.sources, validBank, practice);
      const initialQuestions = pickRandomQuestions(pool.questions, practice.count);
      return (
        <div className="space-y-4">
          {pool.questions.length < practice.count && (
            <div role="status" className="alert alert-warning mx-auto max-w-3xl">
              <span>
                目前符合條件、已框好的題目只有 {pool.questions.length} 題
                {pool.questions.length > 0
                  ? `，先用這 ${pool.questions.length} 題組卷。`
                  : "。請先從考古題匯入並框出題目。"}
              </span>
              <Link href="/past-exams" className="btn btn-sm">回考古題</Link>
            </div>
          )}
          <SheetComposerForm
            key={`practice-${practice.datasetId}-${practice.examType ?? "all"}-${practice.academicYears.join("-")}-${practice.count}`}
            sheetId={null}
            initialTitle={practice.title}
            initialQuestions={initialQuestions}
            missingCount={0}
            bank={pool.questions}
            sources={pool.sources}
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
