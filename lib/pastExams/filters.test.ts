import { describe, expect, it } from "vitest";
import { makeExam } from "../../testing/pastExamsFixtures";
import { facetValues, filterExams, groupByAcademicYear, normalizeQuery, sortExams, UNKNOWN } from "./filters";

describe("normalizeQuery", () => {
  it("applies NFKC, lowercases, folds 臺 into 台 like cowork, and splits on whitespace", () => {
    expect(normalizeQuery("  臺北　ＡＢＣ  １１４ 台中")).toEqual(["台北", "abc", "114", "台中"]);
  });

  it("returns no terms for a blank query", () => {
    expect(normalizeQuery("   ")).toEqual([]);
  });
});

describe("filterExams", () => {
  // cowork 的 search_text 把「臺」統一成「台」（見 output/catalog.jsonl）。
  const a = makeExam({ academicYear: 114, examType: "midterm", city: "臺北市", school: "民權國小", searchText: "114上|台北市 民權國小" });
  const b = makeExam({ academicYear: 113, examType: "final", city: "新北市", school: "安和國小", searchText: "113上|新北市 安和國小" });
  const c = makeExam({ academicYear: 112, examType: "final", city: null, school: null, searchText: "112上" });
  const other = makeExam({ datasetId: "english-grade-05-semester-1-nani", searchText: "114上|台北市 民權國小" });
  const exams = [a, b, c, other];

  it("keeps only the selected dataset", () => {
    expect(filterExams(exams, { datasetId: a.datasetId })).toEqual([a, b, c]);
  });

  it("treats empty filters as no restriction", () => {
    expect(filterExams(exams, { datasetId: null, academicYears: [], examType: null, city: null, query: "" })).toEqual(
      exams,
    );
  });

  it("matches any of the selected academic years", () => {
    expect(filterExams(exams, { datasetId: a.datasetId, academicYears: [114, 112] })).toEqual([a, c]);
  });

  it("filters by exam type", () => {
    expect(filterExams(exams, { datasetId: a.datasetId, examType: "final" })).toEqual([b, c]);
  });

  it("filters by city, with 未知 matching a missing city", () => {
    expect(filterExams(exams, { datasetId: a.datasetId, city: "新北市" })).toEqual([b]);
    expect(filterExams(exams, { datasetId: a.datasetId, city: UNKNOWN })).toEqual([c]);
  });

  it("finds 臺北市 when searching 台北 or 臺北", () => {
    expect(filterExams(exams, { datasetId: a.datasetId, query: "台北" })).toEqual([a]);
    expect(filterExams(exams, { datasetId: a.datasetId, query: "臺北" })).toEqual([a]);
  });

  it("requires every search term to match", () => {
    expect(filterExams(exams, { datasetId: a.datasetId, query: "台北 民權" })).toEqual([a]);
    expect(filterExams(exams, { datasetId: a.datasetId, query: "台北 安和" })).toEqual([]);
  });

  it("combines filters", () => {
    expect(
      filterExams(exams, { datasetId: a.datasetId, academicYears: [113, 114], examType: "final", query: "安和" }),
    ).toEqual([b]);
  });
});

describe("sortExams", () => {
  it("orders by year (newest first), midterm before final, round, then city and school", () => {
    const final114 = makeExam({ academicYear: 114, examType: "final", examRound: 2 });
    const midterm114r2 = makeExam({ academicYear: 114, examType: "midterm", examRound: 2 });
    const midterm114r1b = makeExam({ academicYear: 114, examType: "midterm", examRound: 1, city: "臺北市", school: "民權國小" });
    const midterm114r1a = makeExam({ academicYear: 114, examType: "midterm", examRound: 1, city: "臺北市", school: "大同國小" });
    const unknownCity = makeExam({ academicYear: 114, examType: "midterm", examRound: 1, city: null, school: null });
    const final113 = makeExam({ academicYear: 113, examType: "final", examRound: 2 });
    const input = [final113, unknownCity, final114, midterm114r2, midterm114r1b, midterm114r1a];

    const sorted = sortExams(input);

    expect(sorted).toEqual([midterm114r1a, midterm114r1b, unknownCity, midterm114r2, final114, final113]);
    expect(input[0]).toBe(final113);
  });
});

describe("groupByAcademicYear", () => {
  it("groups consecutive exams by academic year, keeping order", () => {
    const x = makeExam({ academicYear: 114 });
    const y = makeExam({ academicYear: 114 });
    const z = makeExam({ academicYear: 112 });

    expect(groupByAcademicYear([x, y, z])).toEqual([
      { academicYear: 114, label: "114上", exams: [x, y] },
      { academicYear: 112, label: "112上", exams: [z] },
    ]);
  });
});

describe("facetValues", () => {
  it("lists years newest first and cities sorted, with 未知 last", () => {
    const exams = [
      makeExam({ academicYear: 112, city: "臺北市" }),
      makeExam({ academicYear: 114, city: null }),
      makeExam({ academicYear: 112, city: "彰化縣" }),
      makeExam({ academicYear: 113, city: "臺北市" }),
    ];

    expect(facetValues(exams)).toEqual({
      academicYears: [
        { value: 114, label: "114上" },
        { value: 113, label: "113上" },
        { value: 112, label: "112上" },
      ],
      cities: [...["彰化縣", "臺北市"].sort((p, q) => p.localeCompare(q, "zh-Hant")), UNKNOWN],
    });
  });
});
