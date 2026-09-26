import { describe, expect, it } from "vitest";
import { examFileUrl } from "./fileUrl";

describe("examFileUrl", () => {
  it("serves through /exams, encoding each path segment", () => {
    expect(examFileUrl("pdf/ds/考卷 #1.pdf")).toBe("/exams/pdf/ds/%E8%80%83%E5%8D%B7%20%231.pdf");
  });

  it("asks for a download with ?download=1", () => {
    expect(examFileUrl("doc/ds/a.docx", { download: true })).toBe("/exams/doc/ds/a.docx?download=1");
  });
});
