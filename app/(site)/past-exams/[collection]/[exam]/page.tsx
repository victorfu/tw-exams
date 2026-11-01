import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/common/JsonLd";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { collectionPath, collectionShortLabel, pastExamsToolHref } from "@/lib/pastExams/collectionPage";
import { examDescription, examHeading, examPath, examStructuredData, findPublicExam } from "@/lib/pastExams/examPage";
import { examFileUrl } from "@/lib/pastExams/fileUrl";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return pastExamCatalog.exams.filter((exam) => exam.available).map((exam) => ({ collection: exam.datasetId, exam: exam.id }));
}

async function getExam(params: PageProps<"/past-exams/[collection]/[exam]">["params"]) {
  const route = await params;
  // Next 16.3 的預先渲染 params 可能仍含 %3A；先匹配原值，再最多解碼一次。
  // 保留 provider 前綴的 record ID，且不讓不合法的 percent encoding 變成 500。
  let result = findPublicExam(pastExamCatalog, route.collection, route.exam);
  if (!result) {
    try {
      result = findPublicExam(pastExamCatalog, route.collection, decodeURIComponent(route.exam));
    } catch {
      notFound();
    }
  }
  if (!result) notFound();
  return result;
}

export async function generateMetadata({ params }: PageProps<"/past-exams/[collection]/[exam]">): Promise<Metadata> {
  const { exam, collection } = await getExam(params);
  return pageMetadata({ title: examHeading(exam, collection), description: examDescription(exam, collection), path: examPath(exam) });
}

export default async function Page({ params }: PageProps<"/past-exams/[collection]/[exam]">) {
  const { exam, collection } = await getExam(params);
  const heading = examHeading(exam, collection);
  const related = pastExamCatalog.exams.filter((item) => item.available && item.datasetId === collection.id && item.id !== exam.id
    && item.academicYear === exam.academicYear && item.examType === exam.examType).slice(0, 6);
  const facts = [
    ["學年度", `${exam.academicYear} 學年度（民國）`],
    ["縣市／學校", [exam.city, exam.school].filter(Boolean).join("／") || "來源未提供"],
    ["年級、學期與版本", collectionShortLabel(collection)],
    ["考試別", exam.periodLabel],
    ["題目檔案", `${exam.format === "pdf" ? "PDF" : "Word"}${exam.pages ? `，${exam.pages} 頁` : ""}`],
    ["解答", exam.answer ? `附解答卷（${exam.answer.format === "pdf" ? "PDF" : "Word"}）` : "目前未收錄解答卷"],
  ];
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <JsonLd data={examStructuredData(exam, collection)} />
      <nav aria-label="頁面位置" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/" className="hover:underline">首頁</Link><span aria-hidden="true"> ／</span></li>
          <li><Link href={collectionPath(collection)} className="hover:underline">{collectionShortLabel(collection)}</Link><span aria-hidden="true"> ／</span></li>
          <li aria-current="page">考卷詳情</li>
        </ol>
      </nav>
      <h1 className="mt-6 text-3xl leading-tight sm:text-4xl">{heading}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{examDescription(exam, collection)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={pastExamsToolHref(collection, { examId: exam.id })} className="btn btn-primary rounded-full">{exam.format === "pdf" ? "線上預覽考卷" : "在考古題工具中開啟"}</Link>
        <a href={examFileUrl(exam.file, { download: true })} className="btn rounded-full">下載題目卷</a>
        {exam.answer && <a href={examFileUrl(exam.answer.file, { download: true })} className="btn rounded-full">下載解答卷</a>}
      </div>
      <section aria-labelledby="exam-facts" className="mt-10">
        <h2 id="exam-facts" className="text-2xl">考卷資訊</h2>
        <dl className="mt-4 divide-y divide-border-hairline rounded-xl border border-border-hairline bg-card px-5">
          {facts.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
      <section aria-labelledby="exam-source" className="mt-10 space-y-3 leading-relaxed">
        <h2 id="exam-source" className="text-2xl">資料來源與使用限制</h2>
        {exam.source?.url ? <p>來源：<a href={exam.source.url} rel="noopener noreferrer" className="break-all text-accent underline">{exam.source.provider || new URL(exam.source.url).hostname} 原始題目檔案</a>。分類依來源資料整理，請以考卷原文與學校公告的範圍為準。</p>
          : <p>本筆資料未提供可核對的原始來源連結，請以考卷原文與學校公告的範圍為準。</p>}
        {exam.source?.collectedAt && <p>來源收錄日期：<time dateTime={exam.source.collectedAt}>{new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(exam.source.collectedAt))}</time>（不是考試日期或內容更新日期）。</p>}
        <p>本站整理檔案資訊，不代表學校或出版社，也未逐題審核題目與答案。{!exam.answer && "本卷沒有附解答，請勿將自製或 AI 產生的答案視為原卷解答。"}著作權屬於原權利人，僅供個人學習與教學使用。</p>
        <p>分類錯誤、連結失效或下架需求，請附上本頁網址，<a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline">聯絡我們</a>。</p>
      </section>
      <section aria-labelledby="exam-practice" className="mt-10 space-y-3 leading-relaxed">
        <h2 id="exam-practice" className="text-2xl">如何用這份考卷練習？</h2>
        <p>先確認年級、學期、教材版本與考試範圍，再下載或預覽。{exam.answer ? "作答後可用附帶的解答卷核對；若有疑義請向老師確認。" : "本卷未收錄解答，作答後可請老師或家長協助核對。"}</p>
        <p>{exam.format === "pdf" ? "在預覽工具按「框選題目」，可跨考卷選題，再用選好的題目組成練習卷。" : "Word 考卷目前提供下載；若要框題，請先自行轉成 PDF 或圖片再上傳。"}重新整理或關閉分頁會清除自製題庫，請先列印或另存 PDF。</p>
        <Link href="/guides/practice-sheets" className="inline-block text-accent underline">閱讀完整的找考卷與自製練習卷指南</Link>
      </section>
      {related.length > 0 && <section aria-labelledby="related-exams" className="mt-10">
        <h2 id="related-exams" className="text-2xl">同學年度、同考試別的其他考卷</h2>
        <ul className="mt-4 space-y-3">{related.map((item) => <li key={item.id}><Link prefetch={false} href={examPath(item)} className="text-accent underline">{examHeading(item, collection)}</Link></li>)}</ul>
      </section>}
      <Link href={collectionPath(collection)} className="mt-8 inline-block text-accent underline">查看全部{collectionShortLabel(collection)}考古題</Link>
    </article>
  );
}
