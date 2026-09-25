import type { Metadata } from "next";
import { Suspense } from "react";
import PastExamsPage from "@/components/PastExams/PastExamsPage";
import { pastExamCatalog } from "@/lib/pastExams/catalog";

export const metadata: Metadata = {
  title: "考古題",
};

export default function Page() {
  return (
    <Suspense>
      <PastExamsPage catalog={pastExamCatalog} />
    </Suspense>
  );
}
