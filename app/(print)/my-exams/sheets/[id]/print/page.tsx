import SheetPrintView from "@/components/MyExams/SheetPrintView";
import { NOINDEX } from "@/lib/seo";

export const metadata = NOINDEX;

/** 列印版面：獨立全螢幕，不套導覽列（spec §5.1）。 */
export default function Page() {
  return <SheetPrintView />;
}
