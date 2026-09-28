"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Clock3, Sparkles, Star } from "lucide-react";
import { isEditableTarget } from "../MyExams/editorKeyboard";
import { defaultCollection } from "../../lib/pastExams/collections";
import { facetValues, filterExams, groupByAcademicYear, sortExams } from "../../lib/pastExams/filters";
import { subjectLabel, termLabel } from "../../lib/pastExams/labels";
import { readUrlState, writeUrlState, type PastExamsUrlState } from "../../lib/pastExams/searchParams";
import { subjectColors } from "../../lib/pastExams/subjectColors";
import type { AcademicYearGroup } from "../../lib/pastExams/filters";
import type { PastExam, PastExamCatalog } from "../../lib/pastExams/types";
import { CollectionPicker } from "./CollectionPicker";
import { ExamFilters, type FilterPatch } from "./ExamFilters";
import { ExamList } from "./ExamList";
import { ExamPreview } from "./ExamPreview";
import { usePastExamHistory } from "./usePastExamHistory";
import { isDesktop } from "./viewport";

const CLEARED_FILTERS = { academicYears: [], examType: null, city: null, query: "" } satisfies FilterPatch;
type HistoryView = "all" | "favorites" | "recent";

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
  const [historyView, setHistoryView] = useState<HistoryView>("all");
  const [practiceCount, setPracticeCount] = useState(20);
  const history = usePastExamHistory();
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
  const historyExams = useMemo(() => {
    if (historyView === "favorites") return collectionExams.filter((exam) => history.favoriteIds.has(exam.id));
    if (historyView === "recent") {
      const byId = new Map(collectionExams.map((exam) => [exam.id, exam]));
      return history.recent.flatMap((id) => {
        const exam = byId.get(id);
        return exam ? [exam] : [];
      });
    }
    return collectionExams;
  }, [collectionExams, history.favoriteIds, history.recent, historyView]);
  const exams = filterExams(historyExams, url);
  const navigable = exams.filter((exam) => exam.available);
  const selected = navigable.find((exam) => exam.id === url.examId) ?? null;
  const selectedIndex = selected ? navigable.indexOf(selected) : -1;
  const showAnswer = url.showAnswer && selected?.answer != null;

  useEffect(() => {
    if (selected) history.markViewed(selected.id);
  }, [selected?.id, history.markViewed]);

  function update(patch: Partial<PastExamsUrlState>, { push = false } = {}) {
    const query = writeUrlState({ ...url, showAnswer, collectionId: collection?.id ?? null, ...patch });
    const href = query ? `${pathname}?${query}` : pathname;
    if (push) window.history.pushState({ [PREVIEW_ENTRY]: true }, "", href);
    else window.history.replaceState(isPreviewEntry() ? { [PREVIEW_ENTRY]: true } : null, "", href);
  }

  function select(exam: PastExam | null) {
    update({ examId: exam?.id ?? null, showAnswer: false }, { push: exam !== null && selected === null && !isDesktop() });
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
  const currentFavoriteCount = collectionExams.filter((exam) => history.favoriteIds.has(exam.id)).length;
  const currentRecentCount = collectionExams.filter((exam) => history.recentIds.has(exam.id)).length;
  const colors = subjectColors(collection.subject);
  const groups: AcademicYearGroup[] =
    historyView === "recent" && exams.length > 0
      ? [{ academicYear: -1, label: "最近看過", exams }]
      : groupByAcademicYear(exams);

  const practiceParams = new URLSearchParams({
    practice: "1",
    datasetId: collection.id,
    subject: collection.subject,
    count: String(practiceCount),
    title: `${termLabel(collection.grade, collection.semester)} ${subjectLabel(collection.subject, catalog.datasets)} ${collection.publisherLabel}${url.examType === "midterm" ? " 期中" : url.examType === "final" ? " 期末" : ""}練習卷`,
  });
  if (url.examType) practiceParams.set("type", url.examType);
  if (url.academicYears.length > 0) practiceParams.set("year", url.academicYears.join(","));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4 md:grid md:h-[calc(100dvh-2rem)] md:grid-cols-[20rem_minmax(0,1fr)] md:gap-4 md:space-y-0 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-3 md:-mx-1 md:min-h-0 md:overflow-y-auto md:px-1 md:pb-1">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">考古題</h1>
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
          onSelect={(collectionId) => {
            setHistoryView("all");
            update({ collectionId, ...CLEARED_FILTERS, examId: null });
          }}
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

        <section className="surface-card space-y-3 rounded-xl px-3 py-3 sm:px-4" aria-label="收藏與練習卷">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn btn-sm ${historyView === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setHistoryView("all")}>
              全部
            </button>
            <button type="button" className={`btn btn-sm ${historyView === "favorites" ? "btn-primary" : "btn-ghost"}`} onClick={() => setHistoryView("favorites")}>
              <Star className="size-4" aria-hidden="true" />
              收藏 {currentFavoriteCount}
            </button>
            <button type="button" className={`btn btn-sm ${historyView === "recent" ? "btn-primary" : "btn-ghost"}`} onClick={() => setHistoryView("recent")}>
              <Clock3 className="size-4" aria-hidden="true" />
              最近看過 {currentRecentCount}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border-hairline pt-3">
            <span className="text-sm text-base-content/70">幫我出</span>
            <select aria-label="練習卷題數" className="select select-sm w-auto" value={practiceCount} onChange={(event) => setPracticeCount(Number(event.target.value))}>
              {[10, 20, 30, 40].map((count) => <option key={count} value={count}>{count} 題</option>)}
            </select>
            <Link href={`/my-exams/sheets/new?${practiceParams.toString()}`} className="btn btn-primary btn-sm">
              <Sparkles className="size-4" aria-hidden="true" />
              出一份練習卷
            </Link>
            <span className="text-xs text-base-content/50">從已匯入並框好的考古題題庫抽題</span>
          </div>
        </section>

        <ExamList
          groups={groups}
          selectedId={selected?.id ?? null}
          favoriteIds={history.favoriteIds}
          recentIds={history.recentIds}
          onSelect={select}
          onToggleFavorite={history.toggleFavorite}
        />
      </div>

      <section
        aria-label="預覽"
        className={`${selected ? "fixed inset-0 z-40 flex bg-background" : "hidden"} flex-col md:static md:z-auto md:flex md:min-h-0 md:bg-transparent`}
      >
        <ExamPreview
          exam={selected}
          view={showAnswer ? "answer" : "question"}
          onViewChange={(view) => update({ showAnswer: view === "answer" })}
          collection={collection}
          hasPrevious={selectedIndex > 0}
          hasNext={selected !== null && selectedIndex < navigable.length - 1}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
          onClose={closePreview}
        />
      </section>
    </div>
  );
}
