import { Suspense } from "react";
import MyExamsPage from "@/components/MyExams/MyExamsPage";

export default function Page() {
  return (
    <Suspense>
      <MyExamsPage />
    </Suspense>
  );
}
