import data from "../../data/pastExams.json";
import { createAvailableExamLookup } from "./examIndex";
import type { PastExamCatalog } from "./types";

/** `npm run catalog`（dev／build 前自動執行）從 output/ 產生的考古題目錄；build 時打包。 */
export const pastExamCatalog = data as PastExamCatalog;

export const findAvailableExamByFile = createAvailableExamLookup(pastExamCatalog.exams);
