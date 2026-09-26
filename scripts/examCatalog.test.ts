// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFakeOutput } from "../testing/fakeExamOutput";
import { generateExamCatalog } from "./examCatalog";

let root: string;
let outputDir: string;
let dataFile: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "exam-catalog-"));
  outputDir = join(root, "output");
  dataFile = join(root, "data", "pastExams.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("generateExamCatalog", () => {
  it("writes the page catalog from output/ without needing the exam files", async () => {
    await writeFakeOutput(outputDir, [
      { id: "a", path: "pdf/ds/a.pdf" },
      { id: "b", path: "doc/ds/b.docx", downloaded: false },
    ]);
    await rm(join(outputDir, "pdf"), { recursive: true, force: true });

    const catalog = await generateExamCatalog({ outputDir, dataFile });

    expect(catalog.exams.map((exam) => [exam.id, exam.available])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(JSON.parse(await readFile(dataFile, "utf8"))).toEqual(catalog);
  });

  it("fails on a broken catalog and leaves the existing file untouched", async () => {
    await writeFakeOutput(outputDir, [{ id: "a", path: "pdf/ds/a.pdf" }], { recordCount: 3 });
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(dataFile, "old");

    await expect(generateExamCatalog({ outputDir, dataFile })).rejects.toThrow(/record_count/);
    expect(await readFile(dataFile, "utf8")).toBe("old");
  });
});
