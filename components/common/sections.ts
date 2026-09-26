import { FilePen, Library } from "lucide-react";

/** 網站的主要區塊；側邊導覽與首頁都依這個順序列出。 */
export const SECTIONS = [
  { href: "/past-exams", label: "考古題", icon: Library },
  { href: "/my-exams", label: "自製考卷", icon: FilePen },
] as const;
