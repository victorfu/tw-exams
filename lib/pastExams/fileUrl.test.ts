import { afterEach, describe, expect, it, vi } from "vitest";
import { examFileUrl } from "./fileUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("examFileUrl", () => {
  it("serves from /exams by default, encoding each path segment", () => {
    vi.stubEnv("NEXT_PUBLIC_EXAMS_BASE_URL", undefined);
    expect(examFileUrl("pdf/ds/考卷 #1.pdf")).toBe("/exams/pdf/ds/%E8%80%83%E5%8D%B7%20%231.pdf");
  });

  it("uses NEXT_PUBLIC_EXAMS_BASE_URL when set, ignoring a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_EXAMS_BASE_URL", "https://files.example.com/exams/");
    expect(examFileUrl("pdf/ds/a.pdf")).toBe("https://files.example.com/exams/pdf/ds/a.pdf");
  });
});
