import { SiteFooter } from "@/components/Site/SiteFooter";
import { SiteHeader } from "@/components/Site/SiteHeader";

/** 首頁、隱私權政策、服務條款：一般網站的頂部列＋頁尾（工具頁用 (app) 的側邊導覽）。 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
