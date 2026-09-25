"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/my-exams", label: "自製考卷" },
  { href: "/past-exams", label: "考古題" },
] as const;

/** 頂部列的主要導覽；目前所在的區塊（含子頁面）會標示出來。 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="主要導覽" className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
              active
                ? "bg-accent-tint text-accent"
                : "text-base-content/70 hover:bg-accent-tint hover:text-accent"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
