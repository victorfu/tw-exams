import { describe, expect, it } from "vitest";
import { makeCatalog, makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import { examDescription, examPath, examStructuredData, findPublicExam } from "./examPage";
import { toolMetadata } from "./toolMetadata";

describe("public exam discovery", () => {
  const exam = makeExam({ id: "tcool:123", periodLabel: "期中考" });
  const catalog = makeCatalog([exam]);

  it("encodes stable provider-qualified identifiers and rejects unavailable or mismatched records", () => {
    expect(examPath(exam)).toBe(`/past-exams/${MATH_5A.id}/tcool%3A123`);
    expect(findPublicExam(catalog, MATH_5A.id, exam.id)?.exam).toBe(exam);
    expect(findPublicExam(catalog, "wrong-collection", exam.id)).toBeNull();
    expect(findPublicExam(catalog, MATH_5A.id, "missing")).toBeNull();
    expect(findPublicExam(makeCatalog([{ ...exam, available: false }]), MATH_5A.id, exam.id)).toBeNull();
  });

  it("describes missing answers and Word limitations truthfully", () => {
    expect(examDescription(exam, MATH_5A)).toContain("目前未收錄解答卷");
    const word = { ...exam, format: "word" as const, file: "x.docx", pages: null };
    expect(examDescription(word, MATH_5A)).toContain("Word，提供下載");
    expect(examDescription(word, MATH_5A)).not.toContain("線上預覽");
    const resource = examStructuredData(word, MATH_5A)["@graph"][1];
    expect(resource).toMatchObject({ encoding: { encodingFormat: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
    expect(resource).not.toHaveProperty("isBasedOn");
    expect(resource).not.toHaveProperty("datePublished");
    expect(resource).not.toHaveProperty("dateModified");
  });

  it("uses the original source only as provenance, not as a fabricated author or license", () => {
    const source = { url: "https://tcool.cc/d/q/123.pdf", provider: "tcool", collectedAt: "2026-09-26T00:00:00Z" };
    const resource = examStructuredData({ ...exam, source }, MATH_5A)["@graph"][1];
    expect(resource).toMatchObject({ isBasedOn: source.url });
    expect(resource).not.toHaveProperty("author");
    expect(resource).not.toHaveProperty("license");
  });

  it("canonicalizes clean viewer links to their specific public exam or collection", () => {
    expect(toolMetadata(catalog, new URLSearchParams({ c: MATH_5A.id, id: exam.id, view: "answer" })).alternates?.canonical).toBe(examPath(exam));
    expect(toolMetadata(catalog, new URLSearchParams({ c: MATH_5A.id })).alternates?.canonical).toBe(`/past-exams/${MATH_5A.id}`);
    expect(toolMetadata(catalog, new URLSearchParams({ utm_source: "test" })).alternates?.canonical).toBe("/past-exams");
  });

  it.each<Record<string, string>>([{ q: "分數" }, { city: "臺北市" }, { year: "114" }, { type: "final" }, { id: "missing" }, { c: "missing" }])("keeps filtered or invalid results out of the index: %j", (params) => {
    const metadata = toolMetadata(catalog, new URLSearchParams(params));
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toBeUndefined();
  });
});
