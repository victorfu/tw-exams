import Link from "next/link";
import { Logo } from "../common/Logo";
import { SECTIONS } from "../common/sections";
import { ThemeToggle } from "../common/ThemeToggle";

/** 首頁與條款頁共用的頂部列：logo、兩個區塊的入口、亮暗色切換。 */
export function SiteHeader() {
  return (
    <header className="toolbar sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="泡泡考卷首頁">
          <Logo className="size-8" />
          <span className="font-display text-lg">泡泡考卷</span>
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label="主要導覽" className="flex items-center gap-1">
            {SECTIONS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-base-content/70 transition-colors duration-200 hover:bg-accent-tint hover:text-accent"
              >
                {label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
