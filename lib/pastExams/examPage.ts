import { absoluteUrl } from "../site";
import { collectionPath, collectionShortLabel } from "./collectionPage";
import { examFileUrl } from "./fileUrl";
import { gradeLabel, semesterLabel } from "./labels";
import type { PastExam, PastExamCatalog, PastExamCollection } from "./types";

/** 保留 provider 前綴，避免不同來源的流水號碰撞；網址的每個 segment 只編碼一次。 */
export function examPath(exam: Pick<PastExam, "datasetId" | "id">): string {
  return `/past-exams/${encodeURIComponent(exam.datasetId)}/${encodeURIComponent(exam.id)}`;
}

export function findPublicExam(catalog: PastExamCatalog, collectionId: string, examId: string) {
  const collection = catalog.datasets.find((item) => item.id === collectionId);
  const exam = catalog.exams.find((item) => item.id === examId && item.datasetId === collectionId && item.available);
  return collection && exam ? { collection, exam } : null;
}

export function examHeading(exam: PastExam, collection: PastExamCollection): string {
  return `${exam.academicYear}學年度 ${[exam.city, exam.school].filter(Boolean).join(" ") || "學校未提供"} ${gradeLabel(collection.grade)}${semesterLabel(collection.semester)}${collection.subjectLabel}${exam.periodLabel}（${collection.publisherLabel}版）`;
}

export function examDescription(exam: PastExam, collection: PastExamCollection): string {
  const format = exam.format === "pdf" ? "PDF，可線上預覽或下載" : "Word，提供下載";
  return `${examHeading(exam, collection)}。${format}${exam.pages ? `，共 ${exam.pages} 頁` : ""}；${exam.answer ? "附解答卷" : "目前未收錄解答卷"}。考卷來源、檔案資訊與練習方式整理於本頁。`;
}

export function examStructuredData(exam: PastExam, collection: PastExamCollection) {
  const url = absoluteUrl(examPath(exam));
  const name = examHeading(exam, collection);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", "@id": url, url, name,
        description: examDescription(exam, collection), inLanguage: "zh-Hant-TW",
        isPartOf: { "@id": absoluteUrl(collectionPath(collection)) },
        mainEntity: { "@id": `${url}#exam` },
      },
      {
        "@type": "LearningResource", "@id": `${url}#exam`, url, name,
        description: examDescription(exam, collection), inLanguage: "zh-Hant-TW",
        learningResourceType: "考古題", educationalLevel: `國小${gradeLabel(collection.grade)}`,
        about: { "@type": "Thing", name: collection.subjectLabel },
        isAccessibleForFree: true,
        ...(exam.source?.url ? { isBasedOn: exam.source.url } : {}),
        encoding: {
          "@type": "MediaObject", contentUrl: absoluteUrl(examFileUrl(exam.file)),
          encodingFormat: exam.format === "pdf" ? "application/pdf"
            : exam.file.toLowerCase().endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: collectionShortLabel(collection), item: absoluteUrl(collectionPath(collection)) },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      },
    ],
  };
}
