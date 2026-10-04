"use client";

import { useLayoutEffect } from "react";
import { listScrollPositions } from "./workspaceState";

/** Restore only after the list has loaded; save before React removes its content. */
export function useListScroll(href: string, ready: boolean) {
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = listScrollPositions.get(href);
    let frame = 0;
    let restoring = saved !== undefined;
    const capture = () => {
      if (!restoring) listScrollPositions.set(href, window.scrollY);
    };
    if (saved !== undefined) {
      frame = requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: "instant" });
        restoring = false;
      });
    }
    capture();
    window.addEventListener("scroll", capture, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      // The outgoing DOM may already be removed and scrollY clamped during cleanup.
      // Keep the last observed scroll position instead of overwriting it here.
      window.removeEventListener("scroll", capture);
    };
  }, [href, ready]);
}
