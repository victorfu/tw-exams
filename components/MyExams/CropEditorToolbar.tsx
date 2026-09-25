"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { AutosaveStatus } from "../../hooks/autosaveQueue";

type EditorMode = "question" | "mask";

interface CropEditorToolbarProps {
  title: string;
  onRename: (title: string) => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  status: AutosaveStatus;
  onRetry: () => void;
  appendHint: string | null;
}

function SaveStatus({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <button type="button" className="btn btn-ghost btn-xs text-error" onClick={onRetry}>
        儲存失敗・重試
      </button>
    );
  }
  const label = status === "saving" ? "儲存中…" : status === "saved" ? "已儲存" : "";
  return (
    <span className="text-xs text-base-content/60" aria-live="polite">
      {label}
    </span>
  );
}

export function CropEditorToolbar({
  title,
  onRename,
  mode,
  onModeChange,
  status,
  onRetry,
  appendHint,
}: CropEditorToolbarProps) {
  const [draft, setDraft] = useState(title);
  // 開始編輯時的標題：欄位被清空時退回這個標題，不存空白標題。
  const titleBeforeEditRef = useRef(title);

  // 每次輸入就改名（跟答案欄一樣交給自動儲存），不等 blur：焦點還在欄位上
  // 就用瀏覽器「上一頁」離開時不會有 blur，只在 blur 時送出的話改名會遺失。
  const changeTitle = (value: string) => {
    setDraft(value);
    const next = value.trim() || titleBeforeEditRef.current;
    if (next !== title) onRename(next);
  };

  // 離開欄位時顯示實際存下的標題（去掉前後空白、清空時退回原標題）。
  const showSavedTitle = () => setDraft(title);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/my-exams" className="btn btn-ghost btn-sm" aria-label="返回自製考卷">
          <ArrowLeft className="size-4" />
        </Link>
        <input
          className="input input-sm min-w-0 flex-1 font-semibold"
          aria-label="來源標題"
          value={draft}
          onFocus={() => {
            titleBeforeEditRef.current = title;
          }}
          onChange={(event) => changeTitle(event.target.value)}
          onBlur={showSavedTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <div className="join">
          <button
            type="button"
            aria-pressed={mode === "question"}
            className={`btn join-item btn-sm ${mode === "question" ? "btn-primary" : ""}`}
            onClick={() => onModeChange("question")}
          >
            框題目
          </button>
          <button
            type="button"
            aria-pressed={mode === "mask"}
            className={`btn join-item btn-sm ${mode === "mask" ? "btn-primary" : ""}`}
            onClick={() => onModeChange("mask")}
          >
            遮蓋
          </button>
        </div>
        <SaveStatus status={status} onRetry={onRetry} />
      </div>
      {appendHint && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{appendHint}</p>}
      <p className="text-xs text-base-content/60">
        {mode === "question"
          ? "在頁面上拖拉框出一題；點框可以移動，拉四個角調整大小。"
          : "遮蓋模式：框出要蓋掉的答案或紅筆，印出來會是白色。"}
      </p>
    </div>
  );
}
