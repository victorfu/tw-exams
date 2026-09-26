"use client";

import type { CSSProperties } from "react";
import type { SubjectColors } from "../../lib/pastExams/subjectColors";

export const NOT_COLLECTED = "尚未收錄";

interface SegmentButtonProps {
  label: string;
  ariaLabel?: string;
  pressed: boolean;
  enabled?: boolean;
  colors?: SubjectColors;
  onClick: () => void;
}

/** 分段按鈕（放在 daisyUI 的 `join` 裡）；不能按時提示尚未收錄。有科目顏色時選中用該顏色而非預設的 `btn-primary`；未選中時 hover 顯示該科目的淺色（tint）。 */
export function SegmentButton({ label, ariaLabel, pressed, enabled = true, colors, onClick }: SegmentButtonProps) {
  const colored = pressed && colors;
  const hoverTint = !pressed && colors;
  return (
    <button
      type="button"
      className={`btn join-item btn-sm px-3 ${pressed && !colors ? "btn-primary" : ""} ${
        hoverTint ? "hover:[--btn-color:var(--seg-tint)] hover:[--btn-fg:var(--seg-ink)]" : ""
      }`}
      style={
        colored
          ? ({ "--btn-color": colors.solid, "--btn-fg": colors.content } as CSSProperties)
          : hoverTint
            ? ({ "--seg-tint": colors.tint, "--seg-ink": colors.ink } as CSSProperties)
            : undefined
      }
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
