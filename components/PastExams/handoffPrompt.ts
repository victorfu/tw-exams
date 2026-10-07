import { absoluteUrl } from "../../lib/site";
import { examFileUrl } from "../../lib/pastExams/fileUrl";
import type { PastExam, PastExamCollection } from "../../lib/pastExams/types";

export function handoffSources(exams: readonly PastExam[], collections: readonly PastExamCollection[], includeAnswers: boolean): string {
  return exams.map((exam, index) => {
    const collection = collections.find((item) => item.id === exam.datasetId);
    return [
      `${index + 1}. ${exam.title}${collection ? `（${collection.subjectLabel}／${collection.publisherLabel}）` : ""}`,
      `題目：${absoluteUrl(examFileUrl(exam.file))}`,
      ...(includeAnswers && exam.answer ? [`解答：${absoluteUrl(examFileUrl(exam.answer.file))}`] : []),
    ].join("\n");
  }).join("\n\n");
}
export const DEFAULT_HANDOFF_TASK = "請讀取以下考古題，使用繁體中文分析各卷考點、比較題型與重複出現的觀念，並建議複習順序。引用時標明考卷名稱、頁碼或題號。若無法讀取任何檔案，請明確列出並請我上傳，不要憑標題推測內容。";
