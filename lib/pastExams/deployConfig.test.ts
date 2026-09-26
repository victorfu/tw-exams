import { describe, expect, it } from "vitest";
import { checkExamsDeployConfig } from "./deployConfig";

describe("checkExamsDeployConfig", () => {
  it("accepts Blob mode with a connected store", () => {
    expect(checkExamsDeployConfig({ VERCEL: "1", EXAMS_FILE_SOURCE: "blob", BLOB_STORE_ID: "store_x" })).toEqual({});
  });

  it("fails a Vercel build that would read files from output/", () => {
    expect(checkExamsDeployConfig({ VERCEL: "1", EXAMS_FILE_SOURCE: "local", BLOB_STORE_ID: "store_x" }).error).toMatch(
      /EXAMS_FILE_SOURCE/,
    );
  });

  it("fails a Vercel build without a connected Blob store", () => {
    expect(checkExamsDeployConfig({ VERCEL: "1", EXAMS_FILE_SOURCE: "blob" }).error).toMatch(/BLOB_STORE_ID/);
  });

  it("only warns on a local build", () => {
    const result = checkExamsDeployConfig({ EXAMS_FILE_SOURCE: "blob" });
    expect(result.error).toBeUndefined();
    expect(result.warning).toMatch(/BLOB_STORE_ID/);
  });
});
