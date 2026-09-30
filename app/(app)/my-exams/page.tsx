import { Suspense } from "react";
import MyExamsPage from "@/components/MyExams/MyExamsPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "自製考卷：上傳考卷照片框題、隨機組卷列印",
  description:
    "把考卷或講義的照片、PDF 框成題庫，依科目隨機抽題組成 A4 考卷列印，可附答案頁。免費、不用註冊，檔案只在瀏覽器裡處理不會上傳。",
  path: "/my-exams",
});

export default function Page() {
  return (
    <Suspense>
      <MyExamsPage />
    </Suspense>
  );
}
