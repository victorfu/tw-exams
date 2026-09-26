import { describe, expect, it } from "vitest";
import { makeCatalog, makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import { catalogStats } from "./stats";

const english = { ...MATH_5A, id: "english-5a-hess", subject: "english", subjectLabel: "英語", publisher: "hess" };
const englishKang = { ...english, id: "english-5a-kang", publisher: "kang-hsuan" };
const math6b = { ...MATH_5A, id: "math-6b", grade: 6, semester: 2 };
const answer = { file: "pdf/a.pdf", format: "pdf" as const, pages: 1, bytes: 1 };

describe("catalogStats", () => {
  it("counts downloaded exams, answer sheets, subjects and terms", () => {
    const catalog = makeCatalog(
      [
        makeExam({ datasetId: english.id, answer }),
        makeExam({ datasetId: englishKang.id }),
        makeExam({ answer }),
        makeExam({ available: false }),
        makeExam({ datasetId: math6b.id }),
      ],
      [english, englishKang, MATH_5A, math6b],
    );

    expect(catalogStats(catalog)).toEqual({
      exams: 4,
      answers: 2,
      // 科目依固定清單的順序（數學在前），名稱用資料裡的
      subjects: [
        { id: "math", label: "數學", count: 2 },
        { id: "english", label: "英語", count: 2 },
      ],
      terms: ["五年級上學期", "六年級下學期"],
    });
  });

  it("is empty for an empty catalog", () => {
    expect(catalogStats(makeCatalog([], []))).toEqual({ exams: 0, answers: 0, subjects: [], terms: [] });
  });
});
