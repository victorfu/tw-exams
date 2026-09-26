import { describe, expect, it } from "vitest";
import { makeExam } from "../../testing/pastExamsFixtures";
import { createExamFileLookup } from "./examIndex";

describe("createExamFileLookup", () => {
  it("finds downloaded exams by their question file", () => {
    const pdf = makeExam({ file: "pdf/ds/a.pdf" });
    const notDownloaded = makeExam({ file: "pdf/ds/b.pdf", available: false });
    const find = createExamFileLookup([pdf, notDownloaded]);

    expect(find("pdf/ds/a.pdf")).toEqual({ exam: pdf, role: "question" });
    expect(find("pdf/ds/b.pdf")).toBeUndefined();
    expect(find("catalog.jsonl")).toBeUndefined();
  });

  it("finds an exam by its answer sheet", () => {
    const exam = makeExam({
      file: "pdf/ds/a.pdf",
      answer: { file: "pdf/ds/answers/a.pdf", format: "pdf", pages: 1, bytes: 10 },
    });
    const find = createExamFileLookup([exam]);

    expect(find("pdf/ds/answers/a.pdf")).toEqual({ exam, role: "answer" });
  });
});
