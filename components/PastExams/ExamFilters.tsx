"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { FacetValues } from "../../lib/pastExams/filters";
import type { PastExamsUrlState } from "../../lib/pastExams/searchParams";
import type { PastExamType } from "../../lib/pastExams/types";
import { ScrollRow } from "./ScrollRow";
import { SegmentButton } from "./SegmentButton";

export type FilterPatch = Partial<Pick<PastExamsUrlState, "academicYears" | "examType" | "city" | "query">>;

export interface ExamCounts {
  total: number;
  pdf: number;
  word: number;
  unavailable: number;
}

interface ExamFiltersProps {
  facets: FacetValues;
  academicYears: readonly number[];
  examType: PastExamType | null;
  city: string | null;
  /**
   * 網址上的搜尋字。輸入框有自己的狀態（中文輸入法組字時不能被外部值打斷），
   * 網址的 q 被別處改掉（例如點導覽的「考古題」）時才跟著換；換資料集時用 key 重建。
   */
  query: string;
  counts: ExamCounts;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
}

const EXAM_TYPES: readonly { value: PastExamType | null; label: string }[] = [
  { value: null, label: "全部" },
  { value: "midterm", label: "期中" },
  { value: "final", label: "期末" },
];

export function ExamFilters({ facets, academicYears, examType, city, query, counts, onChange, onClear }: ExamFiltersProps) {
  const [text, setText] = useState(query);
  const [composing, setComposing] = useState(false);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    if (!composing) setText(query);
  }
  const hasFilters = academicYears.length > 0 || examType !== null || city !== null || text !== "";

  function toggleYear(year: number) {
    onChange({
      academicYears: academicYears.includes(year)
        ? academicYears.filter((value) => value !== year)
        : [...academicYears, year].sort((a, b) => b - a),
    });
  }

  return (
    <section aria-label="篩選" className="surface-card space-y-3 rounded-xl px-3 py-3 sm:px-4">
      {/* 學年度只佔一列：放不下就左右捲，按鈕只寫年度數字（學期已在標題上）。 */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-base-content/60">學年度</span>
        <ScrollRow aria-label="學年度" className="gap-1">
          {facets.academicYears.map((year) => {
            const pressed = academicYears.includes(year.value);
            return (
              <button
                key={year.value}
                type="button"
                aria-pressed={pressed}
                aria-label={year.label}
                title={year.label}
                className={`btn btn-xs shrink-0 rounded-full px-2 ${pressed ? "btn-primary" : "btn-ghost bg-base-200"}`}
                onClick={() => toggleYear(year.value)}
              >
                {year.value}
              </button>
            );
          })}
        </ScrollRow>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="考試別" className="join">
          {EXAM_TYPES.map((item) => (
            <SegmentButton
              key={item.label}
              label={item.label}
              pressed={examType === item.value}
              onClick={() => onChange({ examType: item.value })}
            />
          ))}
        </div>
        <select
          aria-label="縣市"
          className="select select-sm w-auto"
          value={city ?? ""}
          onChange={(event) => onChange({ city: event.target.value || null })}
        >
          <option value="">全部縣市</option>
          {facets.cities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="input input-sm w-full sm:w-64 md:w-full">
          <Search className="size-4 opacity-50" aria-hidden="true" />
          <input
            type="search"
            aria-label="搜尋"
            placeholder="學校或縣市，例如「台北 民權」"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              // 注音等輸入法還在組字時先不篩選，組完（compositionend）再寫進網址。
              if (!(event.nativeEvent as Partial<InputEvent>).isComposing) onChange({ query: event.target.value });
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(event) => {
              setComposing(false);
              onChange({ query: event.currentTarget.value });
            }}
          />
        </label>
        <div className="flex w-full items-center justify-between gap-3 text-sm text-base-content/70">
          <span>
            共 {counts.total} 份（PDF {counts.pdf}、Word {counts.word}
            {counts.unavailable > 0 && `、未下載 ${counts.unavailable}`}）
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!hasFilters}
            onClick={() => {
              setText("");
              onClear();
            }}
          >
            清除篩選
          </button>
        </div>
      </div>
    </section>
  );
}
