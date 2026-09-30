import { JsonLd } from "@/components/common/JsonLd";
import { faqItems } from "@/components/Site/faq";
import { Landing } from "@/components/Site/Landing";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { collectionPath, collectionShortLabel } from "@/lib/pastExams/collectionPage";
import { catalogStats } from "@/lib/pastExams/stats";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata = {
  ...pageMetadata({ title: `${SITE_NAME}｜國小考古題與自製考卷`, description: SITE_DESCRIPTION, path: "/" }),
  // 首頁標題本身就含網站名稱，不再套「｜泡泡考卷」樣板。
  title: { absolute: `${SITE_NAME}｜國小考古題與自製考卷` },
};

export default function Home() {
  const stats = catalogStats(pastExamCatalog);
  const terms = stats.terms.join("、") || "尚未收錄";
  const home = absoluteUrl("/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        url: home,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "zh-Hant-TW",
      },
      {
        "@type": "WebApplication",
        name: SITE_NAME,
        url: home,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: "zh-Hant-TW",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: 0, priceCurrency: "TWD" },
        audience: { "@type": "EducationalAudience", educationalRole: ["parent", "teacher", "student"] },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems(terms).map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
  const collections = pastExamCatalog.datasets.map((dataset) => ({
    href: collectionPath(dataset),
    label: collectionShortLabel(dataset),
    count: dataset.examCount,
  }));
  return (
    <>
      <JsonLd data={jsonLd} />
      <Landing stats={stats} collections={collections} />
    </>
  );
}
