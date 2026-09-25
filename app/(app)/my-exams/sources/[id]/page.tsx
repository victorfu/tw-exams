import { Suspense } from "react";
import SourceCropEditor from "@/components/MyExams/SourceCropEditor";

export default function Page() {
  return (
    <Suspense>
      <SourceCropEditor />
    </Suspense>
  );
}
