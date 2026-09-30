import { Suspense } from "react";
import SheetComposerPage from "@/components/MyExams/SheetComposerPage";
import { NOINDEX } from "@/lib/seo";

// 資料只在分頁記憶體裡，別人打開是空的：不進搜尋結果。
export const metadata = NOINDEX;

export default function Page() {
  return (
    <Suspense>
      <SheetComposerPage />
    </Suspense>
  );
}
