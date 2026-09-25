import { describe, expect, it } from "vitest";
import { MATH_5A } from "../../testing/pastExamsFixtures";
import { gradeLabel, semesterLabel, SUBJECTS, subjectLabel, termLabel } from "./labels";

describe("labels", () => {
  it("names grades and semesters in Chinese", () => {
    expect(gradeLabel(1)).toBe("一年級");
    expect(gradeLabel(6)).toBe("六年級");
    expect(semesterLabel(1)).toBe("上學期");
    expect(semesterLabel(2)).toBe("下學期");
    expect(termLabel(5, 1)).toBe("五年級 上學期");
  });

  it("lists the five subjects from metadata-format.md", () => {
    expect(SUBJECTS).toEqual([
      { id: "math", label: "數學" },
      { id: "chinese", label: "國語" },
      { id: "english", label: "英文" },
      { id: "science", label: "自然" },
      { id: "social-studies", label: "社會" },
    ]);
  });

  it("prefers the dataset's subject label over the fixed list", () => {
    expect(subjectLabel("math", [{ ...MATH_5A, subjectLabel: "數學科" }])).toBe("數學科");
    expect(subjectLabel("english", [MATH_5A])).toBe("英文");
    expect(subjectLabel("music", [])).toBe("music");
  });
});
