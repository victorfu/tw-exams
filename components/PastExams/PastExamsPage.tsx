"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { facetValues, filterExams, groupByAcademicYear, sortExams } from "../../lib/pastExams/filters";
import { subjectLabel, termLabel } from "../../lib/pastExams/labels";
import { readUrlState, writeUrlState, type PastExamsUrlState } from "../../lib/pastExams/searchParams";
import type { PastExam, PastExamCatalog } from "../../lib/pastExams/types";
import { CollectionPicker } from "./CollectionPicker";
import { ExamFilters, type FilterPatch } from "./ExamFilters";
import { ExamList } from "./ExamList";
import { ExamPreview } from "./ExamPreview";

const CLEARED_FILTERS = { academicYears: [], examType: null, city: null, query: "" } satisfies FilterPatch;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** 考古題瀏覽：選擇列 → 篩選列 → 清單＋預覽。狀態全部放在網址（見 searchParams.ts）。 */
export default function PastExamsPage({ catalog }: { catalog: PastExamCatalog }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = readUrlState(searchParams);
  const collection = catalog.datasets.find((dataset) => dataset.id === url.collectionId) ?? catalog.datasets[0] ?? null;

  const collectionExams = useMemo(
    () => sortExams(catalog.exams.filter((exam) => exam.datasetId === collection?.id)),
    [catalog, collection],
  );
  const facets = useMemo(() => facetValues(collectionExams), [collectionExams]);
  const exams = filterExams(collectionExams, url);
  const navigable = exams.filter((exam) => exam.available);
  const selected = navigable.find((exam) => exam.id === url.examId) ?? null;
  const selectedIndex = selected ? navigable.indexOf(selected) : -1;

  // replaceState 會同步到 useSearchParams，但不會向伺服器重新要頁面（連按 ← → 也不卡）。
  function update(patch: Partial<PastExamsUrlState>) {
    const query = writeUrlState({ ...url, collectionId: collection?.id ?? null, ...patch });
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  function select(exam: PastExam | null) {
    update({ examId: exam?.id ?? null });
  }

  function step(delta: 1 | -1) {
    if (navigable.length === 0) return;
    if (!selected) {
      select(delta > 0 ? navigable[0] : navigable[navigable.length - 1]);
      return;
    }
    const next = navigable[selectedIndex + delta];
    if (next) select(next);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isTyping(event.target)) return;
      const delta = event.key === "ArrowRight" || event.key === "j" ? 1 : event.key === "ArrowLeft" || event.key === "k" ? -1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      step(delta);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!collection) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-base-content/60">
        還沒有考古題資料。執行 <code>npm run sync:exams</code> 同步後再回來。
      </div>
    );
  }

  const counts = {
    total: exams.length,
    pdf: navigable.filter((exam) => exam.format === "pdf").length,
    word: navigable.filter((exam) => exam.format === "word").length,
    unavailable: exams.length - navigable.length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">考古題</h1>
        <p className="text-sm text-base-content/60">
          {termLabel(collection.grade, collection.semester)} {subjectLabel(collection.subject, catalog.datasets)}（
          {collection.publisherLabel}），共 {collectionExams.length} 份
        </p>
      </header>

      <CollectionPicker
        datasets={catalog.datasets}
        current={collection}
        onSelect={(collectionId) => update({ collectionId, ...CLEARED_FILTERS, examId: null })}
      />

      <ExamFilters
        key={collection.id}
        facets={facets}
        academicYears={url.academicYears}
        examType={url.examType}
        city={url.city}
        query={url.query}
        counts={counts}
        onChange={update}
        onClear={() => update(CLEARED_FILTERS)}
      />

      <div className="md:grid md:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)] md:items-start md:gap-4">
        <ExamList groups={groupByAcademicYear(exams)} selectedId={selected?.id ?? null} onSelect={select} />
        {/* 桌機：右側固定的預覽欄。手機：選了考卷才出現的全螢幕預覽層。 */}
        <section
          aria-label="預覽"
          className={`${
            selected ? "fixed inset-0 z-40 flex bg-background" : "hidden"
          } flex-col md:sticky md:top-18 md:z-auto md:flex md:h-[calc(100dvh-6rem)] md:bg-transparent`}
        >
          <ExamPreview
            exam={selected}
            hasPrevious={selectedIndex > 0}
            hasNext={selected !== null && selectedIndex < navigable.length - 1}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            onClose={() => select(null)}
          />
        </section>
      </div>
    </div>
  );
}
