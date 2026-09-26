"use client";

import { useEffect, useRef } from "react";
import { UNKNOWN, type AcademicYearGroup } from "../../lib/pastExams/filters";
import type { PastExam } from "../../lib/pastExams/types";

interface ExamListProps {
  groups: readonly AcademicYearGroup[];
  selectedId: string | null;
  onSelect: (exam: PastExam) => void;
}

/** 依學年度分段的考卷清單；選中的那列會捲進畫面。 */
export function ExamList({ groups, selectedId, onSelect }: ExamListProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // jsdom 沒有 scrollIntoView。
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  if (groups.length === 0) {
    return (
      <p className="surface-card rounded-xl px-4 py-10 text-center text-sm text-base-content/60">沒有符合條件的考卷。</p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.academicYear} aria-label={group.label}>
          <h2 className="mb-1.5 flex items-baseline gap-2 px-1 text-sm font-semibold">
            {group.label}
            <span className="text-xs font-normal text-base-content/50">{group.exams.length} 份</span>
          </h2>
          <ul className="surface-card divide-y divide-border-hairline overflow-hidden rounded-xl">
            {group.exams.map((exam) => {
              const selected = exam.id === selectedId;
              return (
                <li key={exam.id}>
                  <button
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    data-exam-id={exam.id}
                    aria-current={selected ? "true" : undefined}
                    disabled={!exam.available}
                    onClick={() => onSelect(exam)}
                    className={`flex w-full scroll-mt-14 items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
                      selected ? "bg-accent-tint" : "enabled:hover:bg-base-200"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span data-school className={`block truncate font-medium ${selected ? "text-accent" : ""}`}>
                        {exam.school ?? UNKNOWN}
                      </span>
                      <span className="block truncate text-xs text-base-content/60">
                        {exam.city ?? UNKNOWN}
                        {exam.pages !== null && ` · ${exam.pages} 頁`}
                      </span>
                    </span>
                    <span className="badge badge-ghost badge-sm shrink-0">{exam.periodLabel}</span>
                    {exam.answer && (
                      <span className="badge badge-soft badge-success badge-sm shrink-0" title="有解答卷">
                        解答
                      </span>
                    )}
                    <FormatBadge exam={exam} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FormatBadge({ exam }: { exam: PastExam }) {
  if (!exam.available) return <span className="badge badge-outline badge-sm shrink-0">未下載</span>;
  return exam.format === "pdf" ? (
    <span className="badge badge-soft badge-info badge-sm w-12 shrink-0">PDF</span>
  ) : (
    <span className="badge badge-soft badge-secondary badge-sm w-12 shrink-0">Word</span>
  );
}
