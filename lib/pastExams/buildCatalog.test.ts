import { describe, expect, it } from "vitest";
import { buildCatalog, parseCatalogJsonl, type CatalogInfo, type CatalogRecord } from "./buildCatalog";

const DATASET = {
  id: "math-grade-05-semester-1-nani",
  subject: "math",
  subject_label: "數學",
  grade: 5,
  semester: 1,
  publisher: "nani",
  publisher_label: "南一",
  source: { provider: "tcool" },
};

function makeInfo(overrides: Partial<CatalogInfo> = {}): CatalogInfo {
  return {
    schema_version: 1,
    generated_at: "2026-09-25T21:28:57.830696+08:00",
    record_count: 1,
    datasets: [DATASET],
    ...overrides,
  };
}

function makeRecord(
  overrides: Partial<CatalogRecord> = {},
  file: Partial<CatalogRecord["question_file"]> = {},
): CatalogRecord {
  return {
    schema_version: 1,
    record_id: "tcool:20002871",
    dataset_id: DATASET.id,
    title: "114上｜新北市 安和國小｜5年級數學｜南一｜期末2",
    subject: "math",
    subject_label: "數學",
    grade: 5,
    semester: 1,
    semester_label: "上學期",
    publisher: "nani",
    publisher_label: "南一",
    academic_year_roc: 114,
    academic_year_label: "114上",
    exam_type: "final",
    exam_type_label: "期末考",
    exam_round: 2,
    period_code: "4",
    period_label: "期末2",
    city: "新北市",
    school: "安和國小",
    question_file: {
      role: "question",
      original_filename: "20002871b5148af7683e.pdf",
      relative_path: "pdf/math-grade-05-semester-1-nani/20002871b5148af7683e.pdf",
      format: "pdf",
      media_type: "application/pdf",
      downloaded: true,
      bytes: 479511,
      sha256: "ab843da1ed53d7e6028727c6467f22891f419a2e28fdef9e1a9d5713e6899715",
      page_count: 4,
      source_url: "https://tcool.cc/d/q/20002871b5148af7683e.pdf",
      ...file,
    },
    answer_available_from_source: true,
    answer_downloaded: false,
    answer_source_url: "https://tcool.cc/d/a/20002871a5148af7683e.pdf",
    source: { provider: "tcool", exam_id: "20002871" },
    quality: { warnings: [] },
    search_text: "114上|新北市 安和國小|5年級數學|南一|期末2 五上",
    source_metadata: { id: "20002871" },
    ...overrides,
  };
}

describe("buildCatalog", () => {
  it("keeps only the fields the page needs", () => {
    expect(buildCatalog(makeInfo(), [makeRecord()])).toEqual({
      generatedAt: "2026-09-25T21:28:57.830696+08:00",
      datasets: [
        {
          id: "math-grade-05-semester-1-nani",
          subject: "math",
          subjectLabel: "數學",
          grade: 5,
          semester: 1,
          publisher: "nani",
          publisherLabel: "南一",
          examCount: 1,
        },
      ],
      exams: [
        {
          id: "tcool:20002871",
          datasetId: "math-grade-05-semester-1-nani",
          academicYear: 114,
          academicYearLabel: "114上",
          examType: "final",
          examTypeLabel: "期末考",
          examRound: 2,
          periodLabel: "期末考",
          city: "新北市",
          school: "安和國小",
          title: "114上｜新北市 安和國小｜5年級數學｜南一｜期末考",
          file: "pdf/math-grade-05-semester-1-nani/20002871b5148af7683e.pdf",
          format: "pdf",
          pages: 4,
          bytes: 479511,
          available: true,
          answer: null,
          searchText: "114上|新北市 安和國小|5年級數學|南一|期末考 五上",
        },
      ],
    });
  });

  it("rejects an unsupported catalog-info schema_version", () => {
    expect(() => buildCatalog(makeInfo({ schema_version: 2 }), [makeRecord()])).toThrow(/schema_version/);
  });

  it("rejects a record with an unsupported schema_version", () => {
    expect(() => buildCatalog(makeInfo(), [makeRecord({ schema_version: 2 })])).toThrow(
      /tcool:20002871.*schema_version/,
    );
  });

  it("rejects a record_count that does not match the records", () => {
    expect(() => buildCatalog(makeInfo({ record_count: 2 }), [makeRecord()])).toThrow(/record_count/);
  });

  it.each([
    "../secret.pdf",
    "pdf/../../secret.pdf",
    "/etc/passwd",
    "C:/Windows/win.ini",
    "pdf\\..\\..\\secret.pdf",
    "pdf//a.pdf",
    "",
  ])("rejects relative_path %j that escapes the output root", (relativePath) => {
    expect(() => buildCatalog(makeInfo(), [makeRecord({}, { relative_path: relativePath })])).toThrow(
      /relative_path/,
    );
  });

  it("marks a record that was not downloaded as unavailable", () => {
    const catalog = buildCatalog(makeInfo(), [makeRecord({}, { downloaded: false, bytes: null })]);
    expect(catalog.exams[0]).toMatchObject({ available: false, bytes: null });
  });

  it.each(["doc", "docx"])("classifies %s as Word", (format) => {
    const catalog = buildCatalog(makeInfo(), [
      makeRecord({}, { format, relative_path: `doc/x/a.${format}`, page_count: null }),
    ]);
    expect(catalog.exams[0]).toMatchObject({ format: "word", pages: null });
  });

  it("rejects an unknown file format", () => {
    expect(() => buildCatalog(makeInfo(), [makeRecord({}, { format: "jpg" })])).toThrow(/format/);
  });

  it("rejects a record whose dataset is not listed in catalog-info", () => {
    expect(() => buildCatalog(makeInfo(), [makeRecord({ dataset_id: "english-grade-05-semester-1-nani" })])).toThrow(
      /english-grade-05-semester-1-nani/,
    );
  });

  it("rejects a record_id that appears twice", () => {
    expect(() => buildCatalog(makeInfo({ record_count: 2 }), [makeRecord(), makeRecord()])).toThrow(
      /第 2 筆.*record_id/,
    );
  });

  it("folds 臺 into 台 in the search text, in case cowork ever spells it", () => {
    const catalog = buildCatalog(makeInfo(), [makeRecord({ search_text: "114上|臺中市 忠孝國小" })]);
    expect(catalog.exams[0].searchText).toBe("114上|台中市 忠孝國小");
  });
});

describe("buildCatalog period labels", () => {
  function round(examRound: number, examType: string, overrides: Partial<CatalogRecord> = {}) {
    const label = `${examType === "midterm" ? "期中" : "期末"}${examRound}`;
    return makeRecord({
      record_id: `round-${examRound}`,
      exam_round: examRound,
      exam_type: examType,
      period_label: label,
      title: `114上｜安和國小｜${label}`,
      search_text: `安和國小 ${label}`,
      ...overrides,
    });
  }

  function build(records: CatalogRecord[]) {
    return buildCatalog(makeInfo({ record_count: records.length }), records).exams;
  }

  it("removes round numbers for schools with only midterm and final exams", () => {
    const exams = build([round(1, "midterm"), round(2, "final")]);
    expect(exams.map((exam) => exam.periodLabel)).toEqual(["期中考", "期末考"]);
    expect(exams.map((exam) => exam.examRound)).toEqual([1, 2]);
  });

  it("uses three numbered exams in labels, titles and search text regardless of record order", () => {
    const exams = build([round(3, "final"), round(1, "midterm"), round(2, "midterm")]);
    expect(exams.map((exam) => exam.periodLabel)).toEqual(["第三次段考", "第一次段考", "第二次段考"]);
    for (const exam of exams) {
      expect(exam.title).toBe(`114上｜安和國小｜${exam.periodLabel}`);
      expect(exam.searchText).toBe(`安和國小 ${exam.periodLabel}`);
    }
  });

  it("recognizes three rounds even when the second or final exam is missing", () => {
    expect(build([round(1, "midterm"), round(3, "final")]).map((exam) => exam.periodLabel))
      .toEqual(["第一次段考", "第三次段考"]);
    expect(build([round(1, "midterm"), round(2, "midterm")]).map((exam) => exam.periodLabel))
      .toEqual(["第一次段考", "第二次段考"]);
  });

  it.each([
    { school: "民權國小" },
    { city: "臺北市" },
    { academic_year_roc: 113 },
  ])("does not apply another school or year's exam schedule: %j", (overrides) => {
    expect(build([round(3, "final"), round(1, "midterm", overrides)])[1].periodLabel).toBe("期中考");
  });

  it("keeps each dataset's schedule separate", () => {
    const other = { ...DATASET, id: "math-grade-05-semester-2-nani", semester: 2 };
    const records = [round(3, "final"), round(1, "midterm", { dataset_id: other.id })];
    const catalog = buildCatalog(makeInfo({ record_count: 2, datasets: [DATASET, other] }), records);
    expect(catalog.exams[1].periodLabel).toBe("期中考");
  });

  it("does not combine unidentified schools into one school", () => {
    const exams = build([round(3, "final", { school: null }), round(1, "midterm", { school: null })]);
    expect(exams.map((exam) => exam.periodLabel)).toEqual(["第三次段考", "期中考"]);
  });
});

describe("parseCatalogJsonl", () => {
  it("parses one record per line and ignores blank lines", () => {
    const text = `${JSON.stringify(makeRecord())}\n\n${JSON.stringify(makeRecord({ record_id: "tcool:2" }))}\n`;
    expect(parseCatalogJsonl(text).map((record) => record.record_id)).toEqual(["tcool:20002871", "tcool:2"]);
  });

  it("reports the line number of a broken JSON line", () => {
    const text = `${JSON.stringify(makeRecord())}\n{"record_id": \n`;
    expect(() => parseCatalogJsonl(text)).toThrow(/第 2 行/);
  });
});

describe("buildCatalog exam counts", () => {
  it("counts each dataset's exams, including datasets with none", () => {
    const english = { ...DATASET, id: "english-grade-05-semester-1-hess", subject: "english", publisher: "hess" };
    const records = [
      makeRecord({ record_id: "a" }),
      makeRecord({ record_id: "b", dataset_id: english.id }),
      makeRecord({ record_id: "c", dataset_id: english.id }),
    ];

    const catalog = buildCatalog(makeInfo({ record_count: 3, datasets: [DATASET, english, { ...english, id: "empty" }] }), records);

    expect(catalog.datasets.map((dataset) => [dataset.id, dataset.examCount])).toEqual([
      [DATASET.id, 1],
      [english.id, 2],
      ["empty", 0],
    ]);
  });
});

describe("buildCatalog answer sheets", () => {
  const answerFile = {
    role: "answer",
    original_filename: "20002871a5148af7683e.pdf",
    relative_path: "pdf/math-grade-05-semester-1-nani/answers/20002871a5148af7683e.pdf",
    format: "pdf",
    downloaded: true,
    bytes: 170159,
    page_count: 1,
  };

  it("keeps a downloaded answer sheet", () => {
    const catalog = buildCatalog(makeInfo(), [makeRecord({ answer_file: answerFile, answer_downloaded: true })]);
    expect(catalog.exams[0].answer).toEqual({
      file: "pdf/math-grade-05-semester-1-nani/answers/20002871a5148af7683e.pdf",
      format: "pdf",
      pages: 1,
      bytes: 170159,
    });
  });

  it.each(["doc", "docx"])("classifies a %s answer sheet as Word", (format) => {
    const catalog = buildCatalog(makeInfo(), [
      makeRecord(
        { answer_file: { ...answerFile, format, relative_path: `doc/x/answers/a.${format}`, page_count: null }, answer_downloaded: true },
      ),
    ]);
    expect(catalog.exams[0].answer).toMatchObject({ format: "word", pages: null });
  });

  it("leaves out an answer sheet that is missing or not downloaded", () => {
    expect(buildCatalog(makeInfo(), [makeRecord({ answer_file: null })]).exams[0].answer).toBeNull();
    expect(buildCatalog(makeInfo(), [makeRecord()]).exams[0].answer).toBeNull();
    expect(
      buildCatalog(makeInfo(), [makeRecord({ answer_file: { ...answerFile, downloaded: false }, answer_downloaded: false })])
        .exams[0].answer,
    ).toBeNull();
  });

  it("rejects an answer path that escapes the output root", () => {
    expect(() =>
      buildCatalog(makeInfo(), [makeRecord({ answer_file: { ...answerFile, relative_path: "../x.pdf" }, answer_downloaded: true })]),
    ).toThrow(/answer_file.*relative_path/);
  });

  it("rejects an unknown answer format", () => {
    expect(() =>
      buildCatalog(makeInfo(), [makeRecord({ answer_file: { ...answerFile, format: "jpg" }, answer_downloaded: true })]),
    ).toThrow(/answer_file.*format/);
  });
});
