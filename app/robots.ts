import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// 全部開放（含 AI 爬蟲，讓 AI 搜尋能引用本站）；/exams/ 的考卷檔只給本站頁面用，爬了也只會拿到 403。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/exams/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
