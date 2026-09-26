import Link from "next/link";
import { SECTIONS } from "@/components/common/sections";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <nav aria-label="主要導覽" className="flex w-full max-w-sm flex-col gap-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="surface-card rounded-xl px-5 py-4 text-center text-base font-medium transition-colors duration-200 hover:bg-accent-tint hover:text-accent"
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
