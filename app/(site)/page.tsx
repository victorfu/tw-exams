import { Landing } from "@/components/Site/Landing";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { catalogStats } from "@/lib/pastExams/stats";

export default function Home() {
  return <Landing stats={catalogStats(pastExamCatalog)} />;
}
