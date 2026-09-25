import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/contexts/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "自製考卷",
  description: "上傳考卷照片或 PDF，框出題目存進題庫，再隨機組卷印出來。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" data-theme="ollielight" suppressHydrationWarning>
      <body>
        {/* Apply the saved theme before first paint to avoid a flash of the wrong theme. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
