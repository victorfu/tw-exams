import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { SECTIONS } from "@/components/common/sections";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo className="size-20" />
          <h1 className="text-3xl">泡泡考卷</h1>
        </div>
        <nav aria-label="主要導覽" className="w-full flex flex-col gap-3">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="surface-card rounded-xl px-5 py-4 text-center text-base font-display transition-colors duration-200 hover:bg-accent-tint hover:text-accent"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
