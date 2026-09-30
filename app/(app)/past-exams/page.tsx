import type { Metadata } from "next";
import { connection } from "next/server";
import PastExamsPage from "@/components/PastExams/PastExamsPage";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { pageMetadata } from "@/lib/seo";

// 篩選都在網址參數裡，canonical 一律指回 /past-exams；各資料集另有可索引的落地頁（/past-exams/[collection]）。
export const metadata: Metadata = pageMetadata({
  title: "國小考古題：各校段考考卷線上預覽、解答、下載",
  description:
    "依年級、學期、科目與出版社（康軒、翰林、南一、何嘉仁）瀏覽國小段考考古題，可用縣市、學年度、期中／期末、學校篩選，線上預覽 PDF、切換解答、免費下載。",
  path: "/past-exams",
});

export default async function Page() {
  // 每次請求才渲染：useSearchParams 在伺服器上就拿得到網址，清單直接出現在 HTML 裡，
  // 不必等 JS 載入（靜態預先渲染的話，整頁都得在瀏覽器端才畫得出來）。
  await connection();
  return <PastExamsPage catalog={pastExamCatalog} />;
}
