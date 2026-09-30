import type { MetadataRoute } from "next";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { collectionPath } from "@/lib/pastExams/collectionPage";
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
    { url: absoluteUrl("/my-exams"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
