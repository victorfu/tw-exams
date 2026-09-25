import Link from "next/link";
import { Printer } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="toolbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border-hairline px-3 sm:px-4">
        <Link href="/my-exams" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
            <Printer className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight">自製考卷</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1">
        <div className="px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</div>
      </main>
    </div>
  );
}
