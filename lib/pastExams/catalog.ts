import data from "../../data/pastExams.json";
import type { PastExamCatalog } from "./types";

/** `npm run sync:exams` 產生的考古題目錄；build 時打包，上線不需要讀檔系統。 */
export const pastExamCatalog = data as PastExamCatalog;
