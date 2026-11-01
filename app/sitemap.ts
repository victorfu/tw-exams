import type { MetadataRoute } from "next";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { collectionPath } from "@/lib/pastExams/collectionPage";
import { examPath } from "@/lib/pastExams/examPage";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const catalogDate = new Date(pastExamCatalog.generatedAt);
  return [
    { url: absoluteUrl("/"), lastModified: catalogDate, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/past-exams"), lastModified: catalogDate, changeFrequency: "weekly", priority: 0.9 },
    ...pastExamCatalog.datasets.map((dataset) => ({
      url: absoluteUrl(collectionPath(dataset)),
      lastModified: catalogDate,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...pastExamCatalog.exams.filter((exam) => exam.available).map((exam) => ({
      url: absoluteUrl(examPath(exam)),
      // 收錄日期不等於修改日期；沒有可靠的逐卷修改紀錄時省略 lastModified。
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    { url: absoluteUrl("/guides/practice-sheets"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
