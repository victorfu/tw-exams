"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";

const FADE = "1.5rem";

interface Edges {
  start: boolean;
  end: boolean;
}

/** 左右兩側是否還有被捲出去、看不到的內容。 */
export function overflowEdges({ scrollLeft, clientWidth, scrollWidth }: Pick<HTMLElement, "scrollLeft" | "clientWidth" | "scrollWidth">): Edges {
  return { start: scrollLeft > 1, end: scrollLeft < scrollWidth - clientWidth - 1 };
}

/**
 * 只佔一列、放不下就左右捲動的按鈕列（role="group"）：
 * 還能捲的那一側淡出提示；滑鼠滾輪也能左右捲；一開始把已選的項目捲進畫面。
 */
export function ScrollRow({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });

  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const update = () =>
      setEdges((previous) => {
        const next = overflowEdges(row);
        return next.start === previous.start && next.end === previous.end ? previous : next;
      });
    // 直向滾輪換成橫向捲動；捲到頭（或根本不用捲）時交還給頁面。
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = row.scrollWidth - row.clientWidth;
      const next = Math.min(max, Math.max(0, row.scrollLeft + event.deltaY));
      if (max <= 0 || next === row.scrollLeft) return;
      event.preventDefault();
      row.scrollLeft = next;
      update();
    };

    const selected = row.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (selected) row.scrollLeft = selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2;

    // ResizeObserver 開始觀察時就會回報一次，順便算出初始狀態。
    const observer = new ResizeObserver(update);
    observer.observe(row);
    row.addEventListener("scroll", update, { passive: true });
    row.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", update);
      row.removeEventListener("wheel", onWheel);
    };
  }, []);

  const mask = `linear-gradient(to right, ${edges.start ? `transparent, black ${FADE}` : "black"}, ${
    edges.end ? `black calc(100% - ${FADE}), transparent` : "black"
  })`;

  return (
    <div
      ref={ref}
      role="group"
      data-scroll-row
      data-fade-start={edges.start ? "" : undefined}
      data-fade-end={edges.end ? "" : undefined}
      className={`relative flex min-w-0 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      {...props}
    >
      {children}
    </div>
  );
}
