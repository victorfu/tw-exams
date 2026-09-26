"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "./sections";

interface MainNavProps {
  /** rail：桌機左側的直向導覽（圖示在上、文字在下）；bar：手機頂部列的橫向導覽。 */
  variant: "rail" | "bar";
}

/** 主要導覽；目前所在的區塊（含子頁面）會標示出來。 */
export function MainNav({ variant }: MainNavProps) {
  const pathname = usePathname();
  const rail = variant === "rail";

  return (
    <nav aria-label="主要導覽" className={rail ? "flex w-full flex-col items-center gap-1 px-2" : "flex items-center gap-1"}>
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors duration-200 ${
              rail
                ? "flex w-full flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium"
                : "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap"
            } ${active ? "bg-accent-tint text-accent" : "text-base-content/70 hover:bg-accent-tint hover:text-accent"}`}
          >
            <Icon className={rail ? "size-5" : "size-4"} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
