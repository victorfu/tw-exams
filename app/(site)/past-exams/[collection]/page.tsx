import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/common/JsonLd";
import { CollectionLanding } from "@/components/PastExams/CollectionLanding";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import {
  collectionDescription,
  collectionPath,
  collectionShortLabel,
  summarizeCollection,
} from "@/lib/pastExams/collectionPage";
import { gradeLabel } from "@/lib/pastExams/labels";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

// 資料集在 build 時就固定（目錄打包進來），不認得的網址直接 404。
export const dynamicParams = false;

export function generateStaticParams() {
  return pastExamCatalog.datasets.map((dataset) => ({ collection: dataset.id }));
}

export async function generateMetadata({ params }: PageProps<"/past-exams/[collection]">): Promise<Metadata> {
  const summary = summarizeCollection(pastExamCatalog, (await params).collection);
  if (!summary) return {};
  return pageMetadata({
    title: summary.heading,
    description: collectionDescription(summary),
    path: collectionPath(summary.collection),
  });
}

export default async function Page({ params }: PageProps<"/past-exams/[collection]">) {
  const summary = summarizeCollection(pastExamCatalog, (await params).collection);
  if (!summary) notFound();
  const { collection, heading, exams } = summary;
  const url = absoluteUrl(collectionPath(collection));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: heading,
        description: collectionDescription(summary),
        inLanguage: "zh-Hant-TW",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
        dateModified: pastExamCatalog.generatedAt,
        about: { "@type": "Thing", name: `國小${collection.subjectLabel}` },
        educationalLevel: `國小${gradeLabel(collection.grade)}`,
        audience: { "@type": "EducationalAudience", educationalRole: ["student", "parent", "teacher"] },
        isAccessibleForFree: true,
        mainEntity: { "@type": "ItemList", name: heading, numberOfItems: exams.length },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "考古題", item: absoluteUrl("/past-exams") },
          { "@type": "ListItem", position: 3, name: collectionShortLabel(collection), item: url },
        ],
      },
    ],
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <CollectionLanding summary={summary} />
    </>
  );
}
