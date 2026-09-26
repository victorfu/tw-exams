import { describe, expect, it } from "vitest";
import { makeExam } from "../../testing/pastExamsFixtures";
import { createAvailableExamLookup } from "./examIndex";

describe("createAvailableExamLookup", () => {
  it("finds downloaded exams by their file path only", () => {
    const pdf = makeExam({ file: "pdf/ds/a.pdf" });
    const notDownloaded = makeExam({ file: "pdf/ds/b.pdf", available: false });
    const find = createAvailableExamLookup([pdf, notDownloaded]);

    expect(find("pdf/ds/a.pdf")).toBe(pdf);
    expect(find("pdf/ds/b.pdf")).toBeUndefined();
    expect(find("catalog.jsonl")).toBeUndefined();
  });
});
