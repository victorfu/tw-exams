import { FileDropGuard } from "@/components/MyExams/FileDropGuard";
import { NOINDEX } from "@/lib/seo";

// 搜尋入口是公開操作指南；工作區及其子頁只含目前分頁的暫存資料。
export const metadata = NOINDEX;

// (app) 的 layout 也包著 /past-exams；檔案拖放的防護只掛在「我的考卷」底下。
export default function MyExamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FileDropGuard />
      {children}
    </>
  );
}
