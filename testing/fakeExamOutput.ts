import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface FakeExamFile {
  id: string;
  /** relative_path，例如 pdf/ds/a.pdf。 */
  path: string;
  /** 考卷檔內容；catalog 的 bytes 依它計算。 */
  content?: string;
  downloaded?: boolean;
  /** 覆寫 catalog 的 bytes（模擬大小不符）。 */
  bytes?: number | null;
  title?: string;
  /** 解答卷；沒給就沒有解答。 */
  answer?: { path: string; content?: string; bytes?: number | null };
}

/** 在 dir 建一份假的 cowork output：catalog-info.json、catalog.jsonl 與已下載的考卷檔。 */
export async function writeFakeOutput(
  dir: string,
  exams: FakeExamFile[],
  { recordCount = exams.length }: { recordCount?: number } = {},
): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const info = {
    schema_version: 1,
    generated_at: "2026-09-26T10:00:00+08:00",
    record_count: recordCount,
    datasets: [
      { id: "ds", subject: "math", subject_label: "數學", grade: 5, semester: 1, publisher: "nani", publisher_label: "南一" },
    ],
  };
  await writeFile(join(dir, "catalog-info.json"), JSON.stringify(info));
  const lines: string[] = [];
  for (const exam of exams) {
    const downloaded = exam.downloaded ?? true;
    const content = exam.content ?? `content of ${exam.id}`;
    if (downloaded) {
      const target = join(dir, ...exam.path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    const answer = exam.answer;
    const answerContent = answer?.content ?? `answer of ${exam.id}`;
    if (answer) {
      const target = join(dir, ...answer.path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, answerContent);
    }
    lines.push(
      JSON.stringify({
        schema_version: 1,
        record_id: exam.id,
        dataset_id: "ds",
        title: exam.title ?? exam.id,
        academic_year_roc: 114,
        academic_year_label: "114上",
        exam_type: "midterm",
        exam_type_label: "期中考",
        exam_round: 1,
        period_label: "期中1",
        city: "臺北市",
        school: "民權國小",
        question_file: {
          relative_path: exam.path,
          format: exam.path.split(".").pop(),
          downloaded,
          bytes: exam.bytes !== undefined ? exam.bytes : downloaded ? Buffer.byteLength(content) : null,
          page_count: 1,
        },
        answer_file: answer
          ? {
              relative_path: answer.path,
              format: answer.path.split(".").pop(),
              downloaded: true,
              bytes: answer.bytes !== undefined ? answer.bytes : Buffer.byteLength(answerContent),
              page_count: 1,
            }
          : null,
        answer_downloaded: Boolean(answer),
        search_text: exam.id,
      }),
    );
  }
  await writeFile(join(dir, "catalog.jsonl"), `${lines.join("\n")}\n`);
}
