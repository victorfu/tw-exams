import { FileDropGuard } from "@/components/MyExams/FileDropGuard";

// (app) 的 layout 也包著 /past-exams；檔案拖放的防護只掛在「我的考卷」底下。
export default function MyExamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FileDropGuard />
      {children}
    </>
  );
}
