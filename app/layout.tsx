import type { Metadata } from "next";
import { Huninn, Noto_Sans_TC } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { THEME_INIT_SCRIPT } from "@/contexts/themeInit";
import { OG_IMAGE } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// 兩套字都沒有中文 subset：不預載，瀏覽器依 unicode-range 只下載頁面用到的字。
const huninn = Huninn({
  weight: "400",
  variable: "--font-huninn",
  preload: false,
  display: "swap",
  // Next 沒有 Huninn 的字型度量，產生不了替代字型，每次編譯都會警告。Turbopack 只有在
  // 明確給 fallback 時才跳過查表，所以給空陣列；後備字由 globals.css 的 --font-display 決定。
  fallback: [],
  adjustFontFallback: false,
});
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  preload: false,
  display: "swap",
});

// canonical 不放這裡：子頁會繼承，全站都會指回首頁。每頁自己設 alternates.canonical。
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: `${SITE_NAME}｜國小考古題與自製考卷`, template: `%s｜${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: "website", locale: "zh_TW", siteName: SITE_NAME, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      data-theme="paopaolight"
      className={`${huninn.variable} ${notoSansTC.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* A plain inline script runs while <head> is parsed, before first paint, so the
            saved theme applies without a flash. (next/script's beforeInteractive only
            queues inline code until the Next runtime has loaded.) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
