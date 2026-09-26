import { describe, expect, it } from "vitest";
import { subjectColors } from "./subjectColors";
import { SUBJECTS } from "./labels";

describe("subjectColors", () => {
  it("maps every known subject to its CSS variables", () => {
    for (const { id } of SUBJECTS) {
      expect(subjectColors(id)).toEqual({
        solid: `var(--subject-${id})`,
        content: `var(--subject-${id}-content)`,
        tint: `var(--subject-${id}-tint)`,
        ink: `var(--subject-${id}-ink)`,
      });
    }
  });

  it("falls back to the primary colour for unknown subjects", () => {
    expect(subjectColors("music")).toEqual({
      solid: "var(--color-primary)",
      content: "var(--color-primary-content)",
      tint: "var(--accent-tint)",
      ink: "var(--color-primary)",
    });
  });
});
