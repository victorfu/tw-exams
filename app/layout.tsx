import type { Metadata } from "next";
import Script from "next/script";
import { Huninn, Noto_Sans_TC } from "next/font/google";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/contexts/ThemeContext";
import "./globals.css";

// 兩套字都沒有中文 subset：不預載，瀏覽器依 unicode-range 只下載頁面用到的字。
const huninn = Huninn({
  weight: "400",
  variable: "--font-huninn",
  preload: false,
  display: "swap",
});
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "泡泡考卷", template: "%s｜泡泡考卷" },
  description: "瀏覽國小考古題，或上傳考卷照片、PDF 框出題目，隨機組卷印出來。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      data-theme="paopaolight"
      className={`${huninn.variable} ${notoSansTC.variable}`}
      suppressHydrationWarning
    >
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
