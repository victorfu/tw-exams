import type { Metadata } from "next";
import { SITE_NAME } from "./site";

/** 分享預覽圖（`npm run icons` 產生）。子頁設 openGraph 會蓋掉整個 openGraph，所以每頁都要帶。 */
export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: `${SITE_NAME}：國小考古題一次找齊，考卷也能自己組` };

interface PageSeo {
  /** 不含網站名稱；標題樣板會自動接上「｜泡泡考卷」。 */
  title: string;
  description: string;
  /** 站內路徑，也是這頁的 canonical。 */
  path: string;
}

/**
 * 可索引頁面的 metadata：canonical 與 Open Graph 一起設。
 * 子頁設了 openGraph 會整個蓋掉 layout 的，所以 siteName、locale 要在這裡補齊。
 */
export function pageMetadata({ title, description, path }: PageSeo): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "zh_TW", siteName: SITE_NAME, title, description, url: path, images: [OG_IMAGE] },
  };
}

/** 工具頁（資料只在分頁記憶體裡）不進搜尋結果，但連結照常追蹤。 */
export const NOINDEX: Metadata = { robots: { index: false, follow: true } };

/** `<script type="application/ld+json">` 的內容；`<` 轉成 <，字串裡的 `</script>` 才不會提早結束標籤。 */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
