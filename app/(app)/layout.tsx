import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { MainNav } from "@/components/common/MainNav";
import { ThemeToggle } from "@/components/common/ThemeToggle";

/**
 * 桌機：左側固定的窄導覽欄，內容區吃滿整個視窗高度（考卷預覽要的就是高度）。
 * 手機：寬度不夠放側欄，改成精簡的頂部列。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground md:flex">
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-4 border-r border-border-hairline bg-card py-3 md:flex">
        <Link href="/" aria-label="首頁" title="泡泡考卷" className="rounded-xl p-1 transition-colors duration-200 hover:bg-accent-tint">
          <Logo className="size-9" />
        </Link>
        <MainNav variant="rail" />
        <nav aria-label="網站資訊" className="mt-auto flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
          <Link href="/privacy" className="hover:text-accent">
            隱私
          </Link>
          <Link href="/terms" className="hover:text-accent">
            條款
          </Link>
        </nav>
        <ThemeToggle />
      </aside>
      <header className="toolbar sticky top-0 z-30 flex h-12 items-center justify-between gap-3 px-3 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="首頁" className="shrink-0">
            <Logo className="size-7" />
          </Link>
          <MainNav variant="bar" />
        </div>
        <ThemeToggle />
      </header>
      {/* 內容的上下留白（md:py-4）與考古題頁的 md:h-[calc(100dvh-2rem)] 對應，改一邊要一起改。 */}
      <main className="min-w-0 flex-1">
        <div className="px-3 py-4 sm:px-4 md:px-5">{children}</div>
      </main>
    </div>
  );
}
