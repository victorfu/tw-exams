import Link from "next/link";
import { CONTACT_EMAIL } from "../../lib/site";
import { Logo } from "../common/Logo";

/** 首頁與條款頁共用的頁尾：條款連結與聯絡信箱。 */
export function SiteFooter() {
  const link = "transition-colors duration-200 hover:text-accent";
  return (
    <footer className="border-t border-border-hairline bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="font-display text-base text-foreground">泡泡考卷</span>
          <span>・免費的國小考卷工具</span>
        </div>
        <nav aria-label="網站資訊" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className={link}>
            隱私權政策
          </Link>
          <Link href="/terms" className={link}>
            服務條款
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            聯絡我們
          </a>
        </nav>
      </div>
    </footer>
  );
}
