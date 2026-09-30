import { describe, expect, it } from "vitest";
import { makeCatalog, makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import {
  collectionDescription,
  collectionHeading,
  collectionPath,
  collectionShortLabel,
  pastExamsToolHref,
  summarizeCollection,
} from "./collectionPage";
import type { PastExamCollection } from "./types";

const ENGLISH_5A: PastExamCollection = {
  ...MATH_5A,
  id: "english-grade-05-semester-1-kang-hsuan",
  subject: "english",
  subjectLabel: "英語",
  publisher: "kang-hsuan",
  publisherLabel: "康軒",
};
const MATH_6A: PastExamCollection = { ...MATH_5A, id: "math-grade-06-semester-1-nani", grade: 6 };

describe("collection landing labels", () => {
  it("names the term, subject and publisher", () => {
    expect(collectionHeading(ENGLISH_5A)).toBe("五年級上學期英語考古題（康軒版）");
    expect(collectionShortLabel(ENGLISH_5A)).toBe("五上英語（康軒）");
    expect(collectionPath(ENGLISH_5A)).toBe("/past-exams/english-grade-05-semester-1-kang-hsuan");
  });

  it("links into the past-exams tool with the collection and optional exam", () => {
    expect(pastExamsToolHref(MATH_5A)).toBe(`/past-exams?c=${MATH_5A.id}`);
    expect(pastExamsToolHref(MATH_5A, { examId: "tcool:1" })).toBe(`/past-exams?c=${MATH_5A.id}&id=tcool%3A1`);
  });
});

describe("summarizeCollection", () => {
  it("returns null for an unknown collection", () => {
    expect(summarizeCollection(makeCatalog([]), "nope")).toBeNull();
  });

  it("counts only available exams and summarises cities, schools and answers", () => {
    const answer = { file: "a.pdf", format: "pdf" as const, pages: 1, bytes: 1 };
    const catalog = makeCatalog(
      [
        makeExam({ city: "臺北市", school: "甲國小", academicYear: 114, answer }),
        makeExam({ city: "臺北市", school: "乙國小", academicYear: 113 }),
        makeExam({ city: "新竹市", school: "甲國小", academicYear: 114 }),
        makeExam({ city: null, school: null }),
        makeExam({ available: false }),
      ],
      [MATH_5A, ENGLISH_5A, MATH_6A],
    );

    const summary = summarizeCollection(catalog, MATH_5A.id)!;

    expect(summary.exams).toHaveLength(4);
    expect(summary.answers).toBe(1);
    expect(summary.schools).toBe(3);
    expect(summary.cities).toEqual([
      { city: "臺北市", count: 2 },
      { city: "新竹市", count: 1 },
    ]);
    expect(summary.academicYears).toEqual(["114上", "113上"]);
    expect(summary.related.map((dataset) => dataset.id)).toEqual([ENGLISH_5A.id]);
    expect(collectionDescription(summary)).toBe(
      "收錄 4 份五年級上學期數學段考考卷（南一版），其中 1 份附解答，涵蓋 114上、113上 學年度、2 個縣市 3 所國小。免費線上預覽 PDF、下載，也能匯入自製考卷練習。",
    );
  });
});
