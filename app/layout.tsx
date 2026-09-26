import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/contexts/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "泡泡考卷", template: "%s｜泡泡考卷" },
  description: "瀏覽國小考古題，或上傳考卷照片、PDF 框出題目，隨機組卷印出來。",
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
