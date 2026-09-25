"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { FacetValues } from "../../lib/pastExams/filters";
import type { PastExamsUrlState } from "../../lib/pastExams/searchParams";
import type { PastExamType } from "../../lib/pastExams/types";

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
  /** 只當初始值；之後輸入框自己管（中文輸入法組字時不能被外部值打斷）。換資料集時用 key 重建。 */
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
      <div role="group" aria-label="學年度" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-base-content/60">學年度</span>
        {facets.academicYears.map((year) => {
          const pressed = academicYears.includes(year.value);
          return (
            <button
              key={year.value}
              type="button"
              aria-pressed={pressed}
              className={`btn btn-xs rounded-full px-2.5 sm:btn-sm ${pressed ? "btn-primary" : "btn-ghost bg-base-200"}`}
              onClick={() => toggleYear(year.value)}
            >
              {year.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="考試別" className="join">
          {EXAM_TYPES.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={examType === item.value}
              className={`btn join-item btn-sm ${examType === item.value ? "btn-primary" : ""}`}
              onClick={() => onChange({ examType: item.value })}
            >
              {item.label}
            </button>
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
        <label className="input input-sm w-full sm:w-64">
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
            onCompositionEnd={(event) => onChange({ query: event.currentTarget.value })}
          />
        </label>
        <div className="flex w-full items-center justify-between gap-3 text-sm text-base-content/70 lg:ml-auto lg:w-auto">
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
