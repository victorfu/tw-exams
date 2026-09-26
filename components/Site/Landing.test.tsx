import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CatalogStats } from "../../lib/pastExams/stats";
import { Landing } from "./Landing";

const stats: CatalogStats = {
  exams: 852,
  answers: 356,
  subjects: [
    { id: "math", label: "數學", count: 192 },
    { id: "english", label: "英語", count: 331 },
  ],
  terms: ["五年級上學期"],
};

function render(): Document {
  return new DOMParser().parseFromString(renderToStaticMarkup(<Landing stats={stats} />), "text/html");
}

function linkHref(doc: Document, text: string): string | null {
  return [...doc.querySelectorAll("a")].find((link) => link.textContent?.includes(text))?.getAttribute("href") ?? null;
}

describe("Landing", () => {
  it("explains the product in one heading and leads to both sections", () => {
    const doc = render();

    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(linkHref(doc, "開始找考古題")).toBe("/past-exams");
    expect(linkHref(doc, "開始自製考卷")).toBe("/my-exams");
  });

  it("shows what the catalog holds", () => {
    const text = render().body.textContent ?? "";

    expect(text).toContain("852");
    expect(text).toContain("356");
    expect(text).toContain("數學192 份");
    expect(text).toContain("英語331 份");
    expect(text).toContain("五年級上學期");
  });

  it("is free, with no pricing section", () => {
    const text = render().body.textContent ?? "";

    expect(text).toContain("免費");
    expect(text).not.toMatch(/方案|訂閱|NT\$|價格|升級/);
  });

  it("tells people their uploads stay in the browser and vanish on reload", () => {
    const text = render().body.textContent ?? "";

    expect(text).toContain("不會上傳");
    expect(text).toContain("重新整理");
  });
});
