import { describe, expect, it } from "vitest";
import { makeExam } from "../../testing/pastExamsFixtures";
import { contentDisposition, contentTypeFor, downloadFileName, EXAM_FILE_SECURITY_HEADERS } from "./fileResponse";

describe("contentTypeFor", () => {
  it.each([
    ["pdf/ds/a.pdf", "application/pdf"],
    ["doc/ds/a.doc", "application/msword"],
    ["doc/ds/a.DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["pdf/ds/a", "application/octet-stream"],
  ])("%s → %s", (file, type) => {
    expect(contentTypeFor(file)).toBe(type);
  });
});

describe("downloadFileName", () => {
  it("uses the title and the file name's own extension", () => {
    expect(downloadFileName(makeExam({ title: "考卷", file: "doc/ds/a.docx", format: "word" }))).toBe("考卷.docx");
  });

  it("falls back to the format when the file name has no extension", () => {
    expect(downloadFileName(makeExam({ title: "考卷", file: "pdf/v1.2/20002871" }))).toBe("考卷.pdf");
  });
});

describe("answer sheet names", () => {
  const exam = makeExam({
    title: "考卷",
    file: "doc/ds/a.doc",
    format: "word",
    answer: { file: "pdf/ds/answers/a.pdf", format: "pdf", pages: 1, bytes: 10 },
  });

  it("marks the answer sheet in the download name and uses its own extension", () => {
    expect(downloadFileName(exam, "answer")).toBe("考卷（解答）.pdf");
    expect(downloadFileName(exam)).toBe("考卷.doc");
  });

  it("uses the answer file for the ASCII fallback name", () => {
    expect(contentDisposition(exam, true, "answer")).toBe(
      `attachment; filename="a.pdf"; filename*=UTF-8''${encodeURIComponent("考卷（解答）.pdf")}`,
    );
  });
});

describe("contentDisposition", () => {
  const exam = makeExam({ title: "114上｜臺北市 民權國小｜期中1", file: "pdf/ds/20002871b5148af7683e.pdf" });

  it("gives an ASCII fallback name and the UTF-8 title", () => {
    expect(contentDisposition(exam, false)).toBe(
      `inline; filename="20002871b5148af7683e.pdf"; filename*=UTF-8''${encodeURIComponent("114上｜臺北市 民權國小｜期中1.pdf")}`,
    );
  });

  it("asks for a download when requested", () => {
    expect(contentDisposition(exam, true)).toMatch(/^attachment; filename="20002871b5148af7683e\.pdf"; /);
  });

  it("percent-encodes characters RFC 5987 does not allow", () => {
    const odd = makeExam({ title: "考卷(1)*'", file: "pdf/ds/a.pdf" });
    expect(contentDisposition(odd, false)).toContain("filename*=UTF-8''%E8%80%83%E5%8D%B7%281%29%2A%27.pdf");
  });
});

describe("EXAM_FILE_SECURITY_HEADERS", () => {
  it("keeps files to this site and out of search engines, without CORS headers", () => {
    expect(EXAM_FILE_SECURITY_HEADERS).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Robots-Tag": "noindex, nofollow",
    });
    expect(Object.keys(EXAM_FILE_SECURITY_HEADERS).some((key) => key.toLowerCase().startsWith("access-control"))).toBe(false);
  });
});
