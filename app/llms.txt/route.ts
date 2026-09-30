import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { collectionHeading, collectionPath, summarizeCollection } from "@/lib/pastExams/collectionPage";
import { catalogStats } from "@/lib/pastExams/stats";
import { absoluteUrl, CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// 目錄在 build 時就固定，整份檔案預先產生。
export const dynamic = "force-static";

/** /llms.txt（llmstxt.org）：給 AI 助理與 AI 搜尋的網站摘要，從目錄產生。 */
export function GET(): Response {
  const stats = catalogStats(pastExamCatalog);
  const collections = pastExamCatalog.datasets.flatMap((dataset) => {
    const summary = summarizeCollection(pastExamCatalog, dataset.id);
    if (!summary) return [];
    const answers = summary.answers > 0 ? `，${summary.answers} 份附解答` : "";
    return [`- [${collectionHeading(dataset)}](${absoluteUrl(collectionPath(dataset))})：${summary.exams.length} 份${answers}，${summary.cities.length} 個縣市 ${summary.schools} 所國小`];
  });
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

- 對象：台灣國小學生的家長、老師
- 完全免費、沒有廣告、不需要註冊
- 目前收錄：${stats.terms.join("、")}，共 ${stats.exams} 份考古題（${stats.answers} 份附解答）
- 語言：繁體中文（台灣）

## 主要功能

- [考古題](${absoluteUrl("/past-exams")})：依年級、學期、科目、出版社（康軒、翰林、南一、何嘉仁等）瀏覽各校段考考卷，可用縣市、學年度、期中／期末、學校名稱篩選；PDF 在網頁上預覽，有解答卷的可切換「題目｜解答」，也能下載。
- [自製考卷](${absoluteUrl("/my-exams")})：上傳考卷或講義的照片、PDF，框出每一題存成題庫，依科目隨機抽題組成 A4 考卷列印（可附答案頁）。檔案只在瀏覽器裡處理，不會上傳。

## 考古題資料集

${collections.join("\n")}

## 其他

- [隱私權政策](${absoluteUrl("/privacy")})
- [服務條款](${absoluteUrl("/terms")})：考古題僅供個人學習與教學的非商業用途，著作權屬於原學校與出題老師。
- 聯絡：${CONTACT_EMAIL}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
