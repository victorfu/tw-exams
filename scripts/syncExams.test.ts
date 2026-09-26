// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncExams } from "./syncExams";

let root: string;
let sourceDir: string;
let dataFile: string;
let publicExamsDir: string;

interface FakeExam {
  id: string;
  path: string;
  content?: string;
  downloaded?: boolean;
}

async function writeSource(exams: FakeExam[], { recordCount = exams.length } = {}) {
  await rm(sourceDir, { recursive: true, force: true });
  await mkdir(sourceDir, { recursive: true });
  const info = {
    schema_version: 1,
    generated_at: "2026-09-25T21:28:57+08:00",
    record_count: recordCount,
    datasets: [
      { id: "ds", subject: "math", subject_label: "數學", grade: 5, semester: 1, publisher: "nani", publisher_label: "南一" },
    ],
  };
  await writeFile(join(sourceDir, "catalog-info.json"), JSON.stringify(info));
  const lines = [];
  for (const exam of exams) {
    const downloaded = exam.downloaded ?? true;
    if (downloaded) {
      await mkdir(join(sourceDir, exam.path, ".."), { recursive: true });
      await writeFile(join(sourceDir, exam.path), exam.content ?? `content of ${exam.id}`);
    }
    lines.push(
      JSON.stringify({
        schema_version: 1,
        record_id: exam.id,
        dataset_id: "ds",
        title: exam.id,
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
          format: exam.path.endsWith(".pdf") ? "pdf" : "doc",
          downloaded,
          bytes: downloaded ? 10 : null,
          page_count: 1,
        },
        search_text: exam.id,
      }),
    );
  }
  await writeFile(join(sourceDir, "catalog.jsonl"), `${lines.join("\n")}\n`);
}

function run() {
  return syncExams({ sourceDir, dataFile, publicExamsDir });
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1).replaceAll("\\", "/"))
    .sort();
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "sync-exams-"));
  sourceDir = join(root, "output");
  dataFile = join(root, "repo", "data", "pastExams.json");
  publicExamsDir = join(root, "repo", "public", "exams");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("syncExams", () => {
  it("writes the catalog and mirrors downloaded files by relative path", async () => {
    await writeSource([
      { id: "a", path: "pdf/ds/a.pdf" },
      { id: "b", path: "doc/ds/b.doc" },
      { id: "c", path: "pdf/ds/c.pdf", downloaded: false },
    ]);

    const summary = await run();

    expect(summary).toMatchObject({ exams: 3, copied: 2, skipped: 0, removed: 0 });
    expect(await listFiles(publicExamsDir)).toEqual(["doc/ds/b.doc", "pdf/ds/a.pdf"]);
    expect(await readFile(join(publicExamsDir, "pdf/ds/a.pdf"), "utf8")).toBe("content of a");
    const catalog = JSON.parse(await readFile(dataFile, "utf8"));
    expect(catalog.exams.map((exam: { id: string; available: boolean }) => [exam.id, exam.available])).toEqual([
      ["a", true],
      ["b", true],
      ["c", false],
    ]);
  });

  it("skips files that already exist with the same size", async () => {
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf" }]);
    await run();

    expect(await run()).toMatchObject({ copied: 0, skipped: 1, removed: 0 });
  });

  it("copies again when the destination size differs", async () => {
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf" }]);
    await run();
    await writeFile(join(publicExamsDir, "pdf/ds/a.pdf"), "stale");

    expect(await run()).toMatchObject({ copied: 1, skipped: 0 });
    expect(await readFile(join(publicExamsDir, "pdf/ds/a.pdf"), "utf8")).toBe("content of a");
  });

  it("copies again when the source changed but kept its size", async () => {
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf", content: "old content" }]);
    await run();
    const source = join(sourceDir, "pdf/ds/a.pdf");
    await writeFile(source, "new content");
    const later = new Date(Date.now() + 60_000);
    await utimes(source, later, later);

    expect(await run()).toMatchObject({ copied: 1, skipped: 0 });
    expect(await readFile(join(publicExamsDir, "pdf/ds/a.pdf"), "utf8")).toBe("new content");
  });

  it("recreates a file whose path only changed in letter case", async () => {
    await writeSource([{ id: "a", path: "PDF/ds/a.pdf" }]);
    await run();
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf" }]);

    await run();
    expect(await listFiles(publicExamsDir)).toEqual(["pdf/ds/a.pdf"]);
  });

  it("removes files and empty folders that are no longer in the catalog", async () => {
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf" }]);
    await run();
    await writeSource([{ id: "a", path: "math/grade-05/semester-1/nani/pdf/a.pdf" }]);

    expect(await run()).toMatchObject({ copied: 1, removed: 1 });
    expect(await listFiles(publicExamsDir)).toEqual(["math/grade-05/semester-1/nani/pdf/a.pdf"]);
    expect(await readdir(publicExamsDir)).toEqual(["math"]);
  });

  it("leaves existing output untouched when the catalog is invalid", async () => {
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf" }]);
    await run();
    const before = await readFile(dataFile, "utf8");
    await writeSource([{ id: "b", path: "pdf/ds/b.pdf" }], { recordCount: 5 });

    await expect(run()).rejects.toThrow(/record_count/);
    expect(await readFile(dataFile, "utf8")).toBe(before);
    expect(await listFiles(publicExamsDir)).toEqual(["pdf/ds/a.pdf"]);
  });

  it("aborts before writing when a downloaded file is missing from the source", async () => {
    await writeSource([{ id: "a", path: "pdf/ds/a.pdf" }]);
    await rm(join(sourceDir, "pdf/ds/a.pdf"));

    await expect(run()).rejects.toThrow(/pdf\/ds\/a\.pdf/);
    await expect(stat(dataFile)).rejects.toThrow();
  });
});
