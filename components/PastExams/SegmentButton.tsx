"use client";

export const NOT_COLLECTED = "尚未收錄";

interface SegmentButtonProps {
  label: string;
  ariaLabel?: string;
  pressed: boolean;
  enabled?: boolean;
  onClick: () => void;
}

/** 分段按鈕（放在 daisyUI 的 `join` 裡）；不能按時提示尚未收錄。 */
export function SegmentButton({ label, ariaLabel, pressed, enabled = true, onClick }: SegmentButtonProps) {
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
