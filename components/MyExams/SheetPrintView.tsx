"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { PrintPaper, type PrintItem } from "./PrintPaper";
import { PrintToolbar } from "./PrintToolbar";
import { printScaleEnlargesAny, regionAspectRatio } from "./cropStyle";
import {
  PRINT_SCALE_FACTORS,
  readPrintPreferences,
  writePrintPreferences,
  type PrintPreferences,
} from "./printSettings";
import { resolveSheetQuestions } from "./sheetComposition";

export default function SheetPrintView() {
  const { id = "" } = useParams<{ id: string }>();
  const router = useRouter();
  const bank = useQuestionBank();
  const [preferences, setPreferences] = useState<PrintPreferences>(readPrintPreferences);
  const [loadedKeys, setLoadedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const sheet = bank.sheets.find((item) => item.id === id);
  const sourceById = useMemo(() => new Map(bank.sources.map((source) => [source.id, source])), [bank.sources]);
  const { items, missingCount } = useMemo(() => {
    if (!sheet) return { items: [] as PrintItem[], missingCount: 0 };
    const validBank = bank.questions.filter((question) => sourceById.has(question.sourceId));
    const resolved = resolveSheetQuestions(sheet.questionIds, validBank);
    return {
      items: resolved.questions.map((question) => ({
        question,
        pages: sourceById.get(question.sourceId)?.pages ?? [],
      })),
      missingCount: resolved.missingCount,
    };
  }, [sheet, bank.questions, sourceById]);

  const printRegions = items.flatMap(({ question, pages }) =>
    question.regions.flatMap((region, regionIndex) => {
      const page = pages[region.pageIndex];
      return page
        ? [
            {
              key: `${question.id}:${regionIndex}`,
              path: page.storagePath,
              box: region.box,
              aspectRatio: regionAspectRatio(region.box, page),
            },
          ]
        : [];
    }),
  );
  const regionKeys = printRegions.map((region) => region.key);
  const paths = printRegions.map((region) => region.path);
  const { urls, refresh } = useSignedPageUrls(paths);
  const loadedCount = regionKeys.filter((key) => loadedKeys.has(key)).length;
  const failedCount = regionKeys.filter((key) => failedKeys.has(key) && !loadedKeys.has(key)).length;
  const largeScaleCapped = !printScaleEnlargesAny(
    printRegions,
    PRINT_SCALE_FACTORS.normal,
    PRINT_SCALE_FACTORS.large,
  );
  const hasAnswers = items.some(({ question }) => Boolean(question.answer));

  const updatePreferences = (next: PrintPreferences) => {
    setPreferences(next);
    writePrintPreferences(next);
  };

  const markLoaded = (key: string) =>
    setLoadedKeys((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));

  const markFailed = (key: string) =>
    setFailedKeys((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));

  const retryImage = (path: string) => {
    // 重試時這張圖回到「載入中」，重新等它 onLoad / onError
    const retried = new Set(printRegions.filter((region) => region.path === path).map((region) => region.key));
    setFailedKeys((previous) => new Set([...previous].filter((key) => !retried.has(key))));
    void refresh(path);
  };

  const back = () => router.push("/my-exams?tab=sheets");

  if (bank.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" aria-label="載入考卷" />
      </div>
    );
  }

  if (bank.error || !sheet) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base-200">
        <p className="text-base-content/70">{bank.error ?? "找不到這份資料。"}</p>
        <button type="button" className="btn btn-sm" onClick={back}>
          返回自製考卷
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        onBack={back}
        onPrint={() => window.print()}
        loadedCount={loadedCount}
        failedCount={failedCount}
        totalCount={regionKeys.length}
        preferences={preferences}
        onChange={updatePreferences}
        hasAnswers={hasAnswers}
        missingCount={missingCount}
        largeScaleCapped={largeScaleCapped}
      />
      <div className="mx-auto w-fit max-w-full bg-white px-4 py-6 shadow-lg print:w-full print:p-0 print:shadow-none">
        <PrintPaper
          title={sheet.title}
          items={items}
          urls={urls}
          scale={PRINT_SCALE_FACTORS[preferences.scale]}
          enhance={preferences.enhance}
          includeAnswers={hasAnswers && preferences.includeAnswers}
          onImageLoad={markLoaded}
          onImageError={markFailed}
          onRetryImage={retryImage}
        />
      </div>
    </div>
  );
}
