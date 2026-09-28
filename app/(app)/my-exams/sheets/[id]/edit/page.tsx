import { Suspense } from "react";
import SheetComposerPage from "@/components/MyExams/SheetComposerPage";

export default function Page() {
  return (
    <Suspense>
      <SheetComposerPage />
    </Suspense>
  );
}
