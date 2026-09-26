import type { Metadata } from "next";
import { connection } from "next/server";
import PastExamsPage from "@/components/PastExams/PastExamsPage";
import { pastExamCatalog } from "@/lib/pastExams/catalog";

export const metadata: Metadata = {
  title: "考古題",
};

export default async function Page() {
  // 每次請求才渲染：useSearchParams 在伺服器上就拿得到網址，清單直接出現在 HTML 裡，
  // 不必等 JS 載入（靜態預先渲染的話，整頁都得在瀏覽器端才畫得出來）。
  await connection();
  return <PastExamsPage catalog={pastExamCatalog} />;
}
