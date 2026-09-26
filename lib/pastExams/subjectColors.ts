import { SUBJECTS } from "./labels";

export interface SubjectColors {
  solid: string;
  content: string;
  tint: string;
  ink: string;
}

const FALLBACK: SubjectColors = {
  solid: "var(--color-primary)",
  content: "var(--color-primary-content)",
  tint: "var(--accent-tint)",
  ink: "var(--color-primary)",
};

/** 每科一色：實色（選中按鈕）、其上文字、淡色底（標籤）、淡色底上的文字。色值在 globals.css。 */
export function subjectColors(subject: string): SubjectColors {
  if (!SUBJECTS.some((item) => item.id === subject)) return FALLBACK;
  const name = `--subject-${subject}`;
  return {
    solid: `var(${name})`,
    content: `var(${name}-content)`,
    tint: `var(${name}-tint)`,
    ink: `var(${name}-ink)`,
  };
}
