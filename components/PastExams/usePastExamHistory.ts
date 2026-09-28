"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const FAVORITES_KEY = "tw-exams:past-exams:favorites";
const RECENT_KEY = "tw-exams:past-exams:recent";
const MAX_RECENT = 20;

function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: readonly string[]) {
  window.localStorage.setItem(key, JSON.stringify(ids));
}

export function usePastExamHistory() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(readIds(FAVORITES_KEY));
    setRecent(readIds(RECENT_KEY));
  }, []);

  const toggleFavorite = useCallback((examId: string) => {
    setFavorites((previous) => {
      const next = previous.includes(examId)
        ? previous.filter((id) => id !== examId)
        : [examId, ...previous];
      writeIds(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const markViewed = useCallback((examId: string) => {
    setRecent((previous) => {
      const next = [examId, ...previous.filter((id) => id !== examId)].slice(0, MAX_RECENT);
      writeIds(RECENT_KEY, next);
      return next;
    });
  }, []);

  return {
    favoriteIds: useMemo(() => new Set(favorites), [favorites]),
    recentIds: useMemo(() => new Set(recent), [recent]),
    favoriteCount: favorites.length,
    recentCount: recent.length,
    toggleFavorite,
    markViewed,
  };
}
