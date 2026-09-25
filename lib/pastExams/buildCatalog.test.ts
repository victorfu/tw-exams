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
          periodLabel: "期末2",
          city: "新北市",
          school: "安和國小",
          title: "114上｜新北市 安和國小｜5年級數學｜南一｜期末2",
          file: "pdf/math-grade-05-semester-1-nani/20002871b5148af7683e.pdf",
          format: "pdf",
          pages: 4,
          bytes: 479511,
          available: true,
          searchText: "114上|新北市 安和國小|5年級數學|南一|期末2 五上",
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
