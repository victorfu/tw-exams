"use client";

import type { ReactNode } from "react";
import { collectionOptions, pickCollection, type CollectionChoice } from "../../lib/pastExams/collections";
import { GRADES, gradeLabel, gradeNumeral, SEMESTERS, semesterLabel, SUBJECTS, subjectLabel } from "../../lib/pastExams/labels";
import type { PastExamCollection } from "../../lib/pastExams/types";

const NOT_COLLECTED = "尚未收錄";

interface CollectionPickerProps {
  datasets: readonly PastExamCollection[];
  current: PastExamCollection | null;
  onSelect: (collectionId: string) => void;
}

/** 年級、學期、科目的分段按鈕；沒有資料的組合不能按。同一組合有多個版本時才出現版本選單。 */
export function CollectionPicker({ datasets, current, onSelect }: CollectionPickerProps) {
  const options = collectionOptions(datasets, current);
  const fixedSubjects: readonly string[] = SUBJECTS.map((subject) => subject.id);
  const subjects = [
    ...fixedSubjects,
    ...new Set(datasets.map((dataset) => dataset.subject).filter((subject) => !fixedSubjects.includes(subject))),
  ];

  function choose(change: CollectionChoice) {
    const next = pickCollection(datasets, current, change);
    if (next && next.id !== current?.id) onSelect(next.id);
  }

  return (
    <section
      aria-label="選擇年級、學期與科目"
      className="surface-card flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl px-3 py-3 sm:px-4"
    >
      <Segment label="年級">
        {GRADES.map((grade) => (
          <SegmentButton
            key={grade}
            label={gradeNumeral(grade)}
            ariaLabel={gradeLabel(grade)}
            pressed={current?.grade === grade}
            enabled={options.grades.includes(grade)}
            onClick={() => choose({ grade })}
          />
        ))}
      </Segment>
      <Segment label="學期">
        {SEMESTERS.map((semester) => (
          <SegmentButton
            key={semester}
            label={semesterLabel(semester).slice(0, 1)}
            ariaLabel={semesterLabel(semester)}
            pressed={current?.semester === semester}
            enabled={options.semesters.includes(semester)}
            onClick={() => choose({ semester })}
          />
        ))}
      </Segment>
      <Segment label="科目">
        {subjects.map((subject) => (
          <SegmentButton
            key={subject}
            label={subjectLabel(subject, datasets)}
            pressed={current?.subject === subject}
            enabled={options.subjects.includes(subject)}
            onClick={() => choose({ subject })}
          />
        ))}
      </Segment>
      {current && options.publishers.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-base-content/60">版本</span>
          <select
            className="select select-sm w-auto"
            value={current.publisher}
            onChange={(event) => choose({ publisher: event.target.value })}
          >
            {options.publishers.map((dataset) => (
              <option key={dataset.id} value={dataset.publisher}>
                {dataset.publisherLabel}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-xs text-base-content/50">灰色的選項{NOT_COLLECTED}</p>
    </section>
  );
}

function Segment({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-sm text-base-content/60">{label}</span>
      <div className="join">{children}</div>
    </div>
  );
}

interface SegmentButtonProps {
  label: string;
  ariaLabel?: string;
  pressed: boolean;
  enabled: boolean;
  onClick: () => void;
}

function SegmentButton({ label, ariaLabel, pressed, enabled, onClick }: SegmentButtonProps) {
  return (
    <button
      type="button"
      className={`btn join-item btn-sm px-3 ${pressed ? "btn-primary" : ""}`}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={enabled ? undefined : NOT_COLLECTED}
      disabled={!enabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
