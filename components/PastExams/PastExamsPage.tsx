"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isEditableTarget } from "../MyExams/editorKeyboard";
import { defaultCollection } from "../../lib/pastExams/collections";
import { facetValues, filterExams, groupByAcademicYear, sortExams } from "../../lib/pastExams/filters";
import { subjectLabel, termLabel } from "../../lib/pastExams/labels";
import { readUrlState, writeUrlState, type PastExamsUrlState } from "../../lib/pastExams/searchParams";
import { subjectColors } from "../../lib/pastExams/subjectColors";
import type { PastExam, PastExamCatalog } from "../../lib/pastExams/types";
import { CollectionPicker } from "./CollectionPicker";
import { ExamFilters, type FilterPatch } from "./ExamFilters";
import { ExamList } from "./ExamList";
import { ExamPreview } from "./ExamPreview";
import { isDesktop } from "./viewport";

const CLEARED_FILTERS = { academicYears: [], examType: null, city: null, query: "" } satisfies FilterPatch;

/** 手機上打開全螢幕預覽時推進瀏覽紀錄的標記：返回鍵會關掉預覽，而不是離開頁面。 */
const PREVIEW_ENTRY = "pastExamsPreview";

function isPreviewEntry(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[PREVIEW_ENTRY] === true;
}

/** 考古題瀏覽：選擇列 → 篩選列 → 清單＋預覽。狀態全部放在網址（見 searchParams.ts）。 */
export default function PastExamsPage({ catalog }: { catalog: PastExamCatalog }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = readUrlState(searchParams);
  const collection =
    catalog.datasets.find((dataset) => dataset.id === urlState.collectionId) ?? defaultCollection(catalog.datasets);

  const collectionExams = useMemo(
    () => sortExams(catalog.exams.filter((exam) => exam.datasetId === collection?.id)),
    [catalog, collection],
  );
  const facets = useMemo(() => facetValues(collectionExams), [collectionExams]);
  // 網址上的學年度、縣市不在選項裡（舊連結、重新同步後）就當成沒選，免得清單被看不到的條件篩空。
  const url: PastExamsUrlState = {
    ...urlState,
    academicYears: urlState.academicYears.filter((year) => facets.academicYears.some((option) => option.value === year)),
    city: urlState.city !== null && facets.cities.includes(urlState.city) ? urlState.city : null,
  };
  const exams = filterExams(collectionExams, url);
  const navigable = exams.filter((exam) => exam.available);
  const selected = navigable.find((exam) => exam.id === url.examId) ?? null;
  const selectedIndex = selected ? navigable.indexOf(selected) : -1;

  // pushState／replaceState 會同步到 useSearchParams，但不會向伺服器重新要頁面（連按 ← → 也不卡）。
  function update(patch: Partial<PastExamsUrlState>, { push = false } = {}) {
    const query = writeUrlState({ ...url, collectionId: collection?.id ?? null, ...patch });
    const href = query ? `${pathname}?${query}` : pathname;
    if (push) window.history.pushState({ [PREVIEW_ENTRY]: true }, "", href);
    // 在預覽層裡換上一份／下一份時保留標記，關閉時才知道要返回。
    else window.history.replaceState(isPreviewEntry() ? { [PREVIEW_ENTRY]: true } : null, "", href);
  }

  function select(exam: PastExam | null) {
    update({ examId: exam?.id ?? null }, { push: exam !== null && selected === null && !isDesktop() });
  }

  function closePreview() {
    if (isPreviewEntry()) window.history.back();
    else select(null);
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

  // 鍵盤處理用「最新函式」ref：只訂閱一次 keydown，卻總是看到最新狀態（同 CropEditorWorkspace）。
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      const delta = event.key === "ArrowRight" || event.key === "j" ? 1 : event.key === "ArrowLeft" || event.key === "k" ? -1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      step(delta);
    };
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!collection) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-base-content/60">
        還沒有考古題資料。確認 <code>output/</code> 裡有 cowork 的 catalog，再執行 <code>npm run catalog</code>。
      </div>
    );
  }

  const counts = {
    total: exams.length,
    pdf: navigable.filter((exam) => exam.format === "pdf").length,
    word: navigable.filter((exam) => exam.format === "word").length,
    unavailable: exams.length - navigable.length,
  };

  const colors = subjectColors(collection.subject);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">考古題</h1>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-base-content/60">
          <span>{termLabel(collection.grade, collection.semester)}</span>
          <span
            data-subject-tag
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: colors.tint, color: colors.ink }}
          >
            {subjectLabel(collection.subject, catalog.datasets)}
          </span>
          <span>（{collection.publisherLabel}），共 {collectionExams.length} 份</span>
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
            onClose={closePreview}
          />
        </section>
      </div>
    </div>
  );
}
