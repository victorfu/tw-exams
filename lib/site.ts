/** 網站名稱：標題樣板、Open Graph、JSON-LD 都用這個。 */
export const SITE_NAME = "泡泡考卷";

/** 網站的一句話介紹：首頁的 description、JSON-LD、llms.txt。 */
export const SITE_DESCRIPTION = "免費的國小考古題與自製考卷工具：依年級、科目、出版社瀏覽各校段考考卷，線上預覽、看解答、下載；也能上傳考卷照片或 PDF 框出題目，隨機組卷印出來。";

/**
 * 正式網址：canonical、sitemap、Open Graph 的絕對網址都以它為準。
 * 換網域時設 NEXT_PUBLIC_SITE_URL 就好。
 */
export const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tw-exams.vercel.app");

/** 站內路徑轉成絕對網址。 */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** 對外公開的聯絡信箱：頁尾、隱私權政策、服務條款都用這個。 */
export const CONTACT_EMAIL = "supergothere@gmail.com";

/** 隱私權政策與服務條款的生效日期；內容有實質修改時一起更新。 */
export const LEGAL_EFFECTIVE_DATE = "2026 年 9 月 29 日";
