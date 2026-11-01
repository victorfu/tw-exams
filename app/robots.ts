import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// 公開 HTML 可被搜尋與 AI 爬蟲讀取。考卷檔可直連，但由 HTML 詳情頁作為索引入口。
// 不封鎖 /my-exams：爬蟲必須能讀到工作區的 noindex。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/exams/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
