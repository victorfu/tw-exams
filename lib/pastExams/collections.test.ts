import { describe, expect, it } from "vitest";
import { MATH_5A } from "../../testing/pastExamsFixtures";
import { collectionOptions, defaultCollection, pickCollection } from "./collections";
import type { PastExamCollection } from "./types";

function dataset(overrides: Partial<PastExamCollection>): PastExamCollection {
  const merged = { ...MATH_5A, ...overrides };
  return { ...merged, id: `${merged.subject}-${merged.grade}-${merged.semester}-${merged.publisher}` };
}

const math5a = dataset({});
const math5aKang = dataset({ publisher: "kang", publisherLabel: "康軒" });
const english5a = dataset({ subject: "english", subjectLabel: "英文" });
const math5b = dataset({ semester: 2 });
const math6a = dataset({ grade: 6 });
const english6b = dataset({ grade: 6, semester: 2, subject: "english", subjectLabel: "英文" });
const all = [math5a, math5aKang, english5a, math5b, math6a, english6b];

describe("collectionOptions", () => {
  it("enables grades with any data, and semesters/subjects/publishers under the current choice", () => {
    expect(collectionOptions(all, math5a)).toEqual({
      grades: [5, 6],
      semesters: [1, 2],
      subjects: ["math", "english"],
      publishers: [math5a, math5aKang],
    });
    expect(collectionOptions(all, english6b)).toEqual({
      grades: [5, 6],
      semesters: [1, 2],
      subjects: ["english"],
      publishers: [english6b],
    });
  });

  it("has nothing to offer for an empty catalog", () => {
    expect(collectionOptions([], null)).toEqual({ grades: [], semesters: [], subjects: [], publishers: [] });
  });
});

describe("pickCollection", () => {
  it("keeps the other choices when they exist in the new grade", () => {
    expect(pickCollection(all, math5a, { grade: 6 })).toBe(math6a);
  });

  it("falls back to the closest match when the exact combination is missing", () => {
    expect(pickCollection(all, english5a, { grade: 6 })).toBe(math6a);
    expect(pickCollection(all, math5b, { subject: "english" })).toBe(english5a);
  });

  it("switches publisher within the same grade, semester and subject", () => {
    expect(pickCollection(all, math5a, { publisher: "kang" })).toBe(math5aKang);
  });

  it("returns null when nothing matches the change", () => {
    expect(pickCollection(all, math5a, { grade: 3 })).toBeNull();
  });
});

describe("defaultCollection", () => {
  const chinese5a = dataset({ subject: "chinese", subjectLabel: "國語", publisher: "hanlin", publisherLabel: "翰林" });
  const science5a = dataset({ subject: "science", subjectLabel: "自然", publisher: "kang-hsuan", publisherLabel: "康軒" });

  it("starts on 數學 even when the catalog lists another subject first", () => {
    expect(defaultCollection([chinese5a, science5a, math5a])).toBe(math5a);
  });

  it("follows the fixed subject order when there is no 數學", () => {
    expect(defaultCollection([science5a, chinese5a])).toBe(chinese5a);
  });

  it("keeps catalog order within a subject and puts unknown subjects last", () => {
    const music = dataset({ subject: "music", subjectLabel: "音樂" });
    expect(defaultCollection([music, math5aKang, math5a])).toBe(math5aKang);
    expect(defaultCollection([music])).toBe(music);
  });

  it("is null for an empty catalog", () => {
    expect(defaultCollection([])).toBeNull();
  });
});
