import type { Metadata } from "next";
import { NOINDEX, pageMetadata } from "../seo";
import { collectionDescription, collectionPath, summarizeCollection } from "./collectionPage";
import { examDescription, examHeading, examPath, findPublicExam } from "./examPage";
import type { PastExamCatalog } from "./types";

export function toolMetadata(catalog: PastExamCatalog, params: URLSearchParams): Metadata {
  const base = pageMetadata({
    title: "國小考古題：各校段考考卷線上預覽、解答、下載",
    description: "依年級、學期、科目與出版社瀏覽國小段考考古題，可用縣市、學年度、期中／期末、學校篩選，線上預覽 PDF、切換解答、免費下載。",
    path: "/past-exams",
  });
  // 搜尋、篩選結果不是完整分類頁，也可能把選定考卷排除；不要宣告不相等的 canonical。
  if (["q", "city", "year", "type"].some((key) => params.get(key))) {
    return { ...base, ...NOINDEX, alternates: undefined };
  }
  const collection = params.get("c");
  const id = params.get("id");
  if (collection && id) {
    const detail = findPublicExam(catalog, collection, id);
    if (detail) return pageMetadata({
      title: examHeading(detail.exam, detail.collection),
      description: examDescription(detail.exam, detail.collection),
      path: examPath(detail.exam),
    });
  } else if (collection && !id) {
    const summary = summarizeCollection(catalog, collection);
    if (summary) return pageMetadata({ title: summary.heading, description: collectionDescription(summary), path: collectionPath(summary.collection) });
  }
  // 無效選取不作為搜尋入口；不影響工具原有容錯操作。
  return collection || id ? { ...base, ...NOINDEX, alternates: undefined } : base;
}
