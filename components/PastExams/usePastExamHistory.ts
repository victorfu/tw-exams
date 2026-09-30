"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const FAVORITES_KEY = "tw-exams:past-exams:favorites";
const RECENT_KEY = "tw-exams:past-exams:recent";
const MAX_RECENT = 20;
const EMPTY: readonly string[] = [];

/**
 * localStorage 當成外部 store 給 useSyncExternalStore 讀：伺服器與 hydration 時是空清單，
 * 之後才換成瀏覽器存的值，不會對不上。其他分頁改了（storage 事件）也會跟著更新。
 */
interface Entry {
  /** 上次讀到的原始字串；沒變就回傳同一個陣列，useSyncExternalStore 才不會一直重畫。 */
  raw: string | null;
  ids: readonly string[];
  /** Storage 被停用或寫入失敗：只在本次分頁的記憶體裡保留。 */
  memoryOnly: boolean;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

function parseIds(raw: string | null): readonly string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readIds(key: string): readonly string[] {
  const entry = entries.get(key);
  if (entry?.memoryOnly) return entry.ids;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return entry?.ids ?? EMPTY;
  }
  if (entry && entry.raw === raw) return entry.ids;
  const ids = parseIds(raw);
  entries.set(key, { raw, ids, memoryOnly: false });
  return ids;
}

function writeIds(key: string, ids: readonly string[]) {
  const raw = JSON.stringify(ids);
  let memoryOnly = false;
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage 被瀏覽器停用或額度不足時，功能仍可在本次分頁內使用。
    memoryOnly = true;
  }
  entries.set(key, { raw, ids, memoryOnly });
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const getServerIds = () => EMPTY;
const getFavorites = () => readIds(FAVORITES_KEY);
const getRecent = () => readIds(RECENT_KEY);

export function usePastExamHistory() {
  const favorites = useSyncExternalStore(subscribe, getFavorites, getServerIds);
  const recent = useSyncExternalStore(subscribe, getRecent, getServerIds);

  const toggleFavorite = useCallback((examId: string) => {
    const previous = readIds(FAVORITES_KEY);
    writeIds(
      FAVORITES_KEY,
      previous.includes(examId) ? previous.filter((id) => id !== examId) : [examId, ...previous],
    );
  }, []);

  const markViewed = useCallback((examId: string) => {
    const previous = readIds(RECENT_KEY);
    const next = [examId, ...previous.filter((id) => id !== examId)].slice(0, MAX_RECENT);
    // 已經在最前面就不寫：markViewed 在 effect 裡呼叫，寫了會通知 store、再觸發一次重畫。
    if (next.length === previous.length && next.every((id, index) => id === previous[index])) return;
    writeIds(RECENT_KEY, next);
  }, []);

  return {
    favorites,
    recent,
    favoriteIds: useMemo(() => new Set(favorites), [favorites]),
    recentIds: useMemo(() => new Set(recent), [recent]),
    favoriteCount: favorites.length,
    recentCount: recent.length,
    toggleFavorite,
    markViewed,
  };
}
