"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { createSelectionDraft } from "../MyExams/workspaceState";
import { clearExams, selectExams, toggleExam, usePastExamSelection } from "./selectionState";
import { ChatGPTHandoff } from "./ChatGPTHandoff";
import { QuestionBasket } from "./QuestionBasket";
import { ExamPreview, type ExamPreviewHandle } from "./ExamPreview";
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

/** 考古題瀏覽：選擇列 → 篩選列 → 清單＋預覽。篩選與預覽放在網址，多選保留於分頁記憶體。 */
export default function PastExamsPage({ catalog }: { catalog: PastExamCatalog }) {
  const pathname = usePathname();
  const router = useRouter();
  const selection = usePastExamSelection();
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const previewRef = useRef<ExamPreviewHandle>(null);
  const selectedExams = selection.examIds.flatMap((id) => {
    const exam = catalog.exams.find((item) => item.id === id && item.available);
    return exam ? [exam] : [];
  });
  function guard(action: () => void) {
    if (leavingRef.current) return;
    if (!editing) { action(); return; }
    leavingRef.current = true;
    setLeaving(true);
    void (async () => {
      try { if (await previewRef.current?.flush()) action(); }
      finally { leavingRef.current = false; setLeaving(false); }
    })();
  }
  const compose = () => guard(() => {
    const token = createSelectionDraft(selection.questions.map((item) => item.question.id), `${pathname}?${searchParams}`);
    router.push(`/my-exams/sheets/new?selection=${encodeURIComponent(token)}`);
  });
  const searchParams = useSearchParams();
  const [historyView, setHistoryView] = useState<HistoryView>("all");
  const [recentOrder, setRecentOrder] = useState<readonly string[]>([]);
  const [practiceCount, setPracticeCount] = useState(20);
  const history = usePastExamHistory();
  const { markViewed } = history;
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
      return recentOrder.flatMap((id) => {
        const exam = byId.get(id);
        return exam ? [exam] : [];
      });
    }
    return collectionExams;
  }, [collectionExams, history.favoriteIds, recentOrder, historyView]);
  const exams = filterExams(historyExams, url);
  const navigable = exams.filter((exam) => exam.available);
  const selected = navigable.find((exam) => exam.id === url.examId) ?? null;
  const selectedId = selected?.id ?? null;
  const selectedIndex = selected ? navigable.indexOf(selected) : -1;
  const showAnswer = url.showAnswer && selected?.answer != null;

  useEffect(() => {
    if (selectedId) markViewed(selectedId);
  }, [selectedId, markViewed]);

  function updateUrl(patch: Partial<PastExamsUrlState>, { push = false } = {}) {
    const query = writeUrlState({ ...url, showAnswer, collectionId: collection?.id ?? null, ...patch });
    const href = query ? `${pathname}?${query}` : pathname;
    if (push) window.history.pushState({ [PREVIEW_ENTRY]: true }, "", href);
    else window.history.replaceState(isPreviewEntry() ? { [PREVIEW_ENTRY]: true } : null, "", href);
  }

  function update(patch: Partial<PastExamsUrlState>, options = {}) {
    guard(() => updateUrl(patch, options));
  }

  function select(exam: PastExam | null) {
    update({ examId: exam?.id ?? null, showAnswer: false }, { push: exam !== null && selected === null && !isDesktop() });
  }

  function closePreview() {
    if (isPreviewEntry()) guard(() => window.history.back());
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
      if (editing || leavingRef.current || handoffOpen) return;
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

  const navigationRef = useRef({ editing, guard, href: `${pathname}?${searchParams}`, state: null as unknown });
  useEffect(() => { navigationRef.current = { editing, guard, href: `${pathname}?${searchParams}`, state: window.history.state }; });
  useEffect(() => {
    let replaying = false;
    const click = (event: MouseEvent) => {
      if (!navigationRef.current.editing || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      navigationRef.current.guard(() => router.push(target.pathname + target.search + target.hash));
    };
    const pop = (event: PopStateEvent) => {
      if (replaying || !navigationRef.current.editing) return;
      event.stopImmediatePropagation();
      const target = window.location.href;
      const targetState = event.state;
      window.history.replaceState(navigationRef.current.state, "", navigationRef.current.href);
      navigationRef.current.guard(() => {
        window.history.replaceState(targetState, "", target);
        replaying = true;
        window.dispatchEvent(new PopStateEvent("popstate", { state: targetState }));
        replaying = false;
      });
    };
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop, true);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop, true);
    };
  }, [router]);

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
    <div inert={leaving} aria-busy={leaving} className="mx-auto max-w-screen-2xl space-y-4 md:grid md:h-[calc(100dvh-2rem)] md:grid-cols-[20rem_minmax(0,1fr)] md:gap-4 md:space-y-0 xl:grid-cols-[24rem_minmax(0,1fr)]">
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
          onSelect={(collectionId) => guard(() => {
            setHistoryView("all");
            updateUrl({ collectionId, ...CLEARED_FILTERS, examId: null });
          })}
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
            <button type="button" className={`btn btn-sm ${historyView === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => guard(() => setHistoryView("all"))}>
              全部
            </button>
            <button type="button" className={`btn btn-sm ${historyView === "favorites" ? "btn-primary" : "btn-ghost"}`} onClick={() => guard(() => setHistoryView("favorites"))}>
              <Star className="size-4" aria-hidden="true" />
              收藏 {currentFavoriteCount}
            </button>
            <button type="button" className={`btn btn-sm ${historyView === "recent" ? "btn-primary" : "btn-ghost"}`} onClick={() => guard(() => {
              // 開啟清單時固定順序，預覽仍更新瀏覽紀錄，但不改變上一份／下一份的位置。
              setRecentOrder(history.recent);
              setHistoryView("recent");
            })}>
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

        <section className="surface-card space-y-2 rounded-xl p-3" aria-label="多選考卷">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" disabled={!navigable.length} onClick={() => selectExams(navigable.map((exam) => exam.id))}>全選目前結果</button>
            <button className="btn btn-primary btn-sm" disabled={!selectedExams.length} onClick={() => setHandoffOpen(true)}>交給 ChatGPT（{selectedExams.length}）</button>
          </div>
          {selectedExams.length > 0 && <details><summary className="cursor-pointer text-sm">已選 {selectedExams.length} 份考卷</summary>
            <ul className="mt-2 max-h-48 space-y-2 overflow-auto text-sm">{selectedExams.map((exam) => <li key={exam.id} className="flex items-center gap-2"><span className="min-w-0 flex-1">{exam.title}</span><button className="btn btn-ghost btn-xs" aria-label={`移除考卷 ${exam.title}`} onClick={() => toggleExam(exam.id)}>移除</button></li>)}</ul>
            <button className="btn btn-ghost btn-xs" onClick={clearExams}>清空考卷選取</button>
          </details>}
        </section>
        <QuestionBasket onCompose={compose} />
        <ExamList
          checkedIds={selection.examIds}
          onToggleChecked={toggleExam}
          groups={groups}
          selectedId={selected?.id ?? null}
          favoriteIds={history.favoriteIds}
          recentIds={history.recentIds}
          onSelect={select}
          onToggleFavorite={(id) => guard(() => history.toggleFavorite(id))}
        />
      </div>

      <section
        aria-label="預覽"
        className={`${selected ? "fixed inset-0 z-40 flex bg-background" : "hidden"} flex-col md:static md:z-auto md:flex md:min-h-0 md:bg-transparent`}
      >
        <ExamPreview
          ref={previewRef}
          onEditingChange={setEditing}
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
        {selected && <div className="max-h-[35dvh] shrink-0 overflow-auto md:hidden"><QuestionBasket onCompose={compose} /></div>}
      </section>
      {handoffOpen && <ChatGPTHandoff exams={selectedExams} collections={catalog.datasets} onClose={() => setHandoffOpen(false)} />}
    </div>
  );
}
