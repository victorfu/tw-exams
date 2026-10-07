import { beforeEach, describe, expect, it } from "vitest";
import { createSelectionDraft, readSelectionDraft, completeSelectionDraft, resetWorkspaceState, safeReturnTo, sourceEditorHref } from "./workspaceState";

beforeEach(resetWorkspaceState);

describe("workspace navigation and selection drafts", () => {
  it("accepts only internal list URLs and recognized parameters", () => {
    for (const value of ["https://evil.test/my-exams", "//evil.test", "/my-exams/other", "/my-exams#bad", "/my-exams?x=1#bad", "javascript:alert(1)", "/my-exams?x=\\evil"]) {
      expect(safeReturnTo(value)).toBe("/my-exams");
    }
    expect(safeReturnTo("/my-exams?tab=sources&subject=math&source=abc&search=test&other=x")).toBe("/my-exams?tab=sources&subject=math&source=abc&search=test");
    expect(safeReturnTo("/my-exams?tab=invalid&subject=invalid")).toBe("/my-exams");
    const href = new URL(sourceEditorHref("source-1", "/my-exams?search=a+b", "q1"), "https://local.invalid");
    expect(href.searchParams.get("q")).toBe("q1");
    expect(href.searchParams.get("returnTo")).toBe("/my-exams?search=a+b");
  });

  it("copies ordered selections, deduplicates them, and removes only the completed draft", () => {
    const ids = ["b", "a", "b"];
    const token = createSelectionDraft(ids, "/my-exams?subject=math");
    const other = createSelectionDraft(["c"], "/my-exams");
    ids.push("d");
    expect(readSelectionDraft(token)?.ids).toEqual(["b", "a"]);
    completeSelectionDraft(token);
    expect(readSelectionDraft(token)).toBeUndefined();
    expect(readSelectionDraft(other)?.ids).toEqual(["c"]);
  });
});

it("restores only recognized past exam filters and preview state", () => {
  expect(safeReturnTo("/past-exams?c=math&year=114,113&type=midterm&city=臺北市&q=school&id=abc&view=answer&bad=x"))
    .toBe("/past-exams?c=math&year=114%2C113&type=midterm&city=%E8%87%BA%E5%8C%97%E5%B8%82&q=school&id=abc&view=answer");
  for (const path of ["//evil.test/past-exams", "/past-exams/other", "/past-exams?x=1#bad", "/past-exams?x=\\evil", "/past-exams/../other"])
    expect(safeReturnTo(path)).toBe("/my-exams");
});
