import { FileDropGuard } from "@/components/MyExams/FileDropGuard";

// 列印頁不在 (app) 底下，也要擋住檔案拖放，免得瀏覽器開檔把題庫清空。
export default function MyExamsPrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FileDropGuard />
      {children}
    </>
  );
}
