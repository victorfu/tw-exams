import type { Metadata } from "next";
import { connection } from "next/server";
import PastExamsPage from "@/components/PastExams/PastExamsPage";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { toolMetadata } from "@/lib/pastExams/toolMetadata";

export async function generateMetadata({ searchParams }: PageProps<"/past-exams">): Promise<Metadata> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value !== undefined) params.set(key, Array.isArray(value) ? value[0] : value);
  }
  return toolMetadata(pastExamCatalog, params);
}

export default async function Page() {
  // 每次請求才渲染：useSearchParams 在伺服器上就拿得到網址，清單直接出現在 HTML 裡，
  // 不必等 JS 載入（靜態預先渲染的話，整頁都得在瀏覽器端才畫得出來）。
  await connection();
  return <PastExamsPage catalog={pastExamCatalog} />;
}
