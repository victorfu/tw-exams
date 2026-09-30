import { describe, expect, it } from "vitest";
import { jsonLdHtml, OG_IMAGE, pageMetadata } from "./seo";

describe("pageMetadata", () => {
  it("sets the canonical and a complete Open Graph block", () => {
    expect(pageMetadata({ title: "考古題", description: "說明", path: "/past-exams" })).toEqual({
      title: "考古題",
      description: "說明",
      alternates: { canonical: "/past-exams" },
      openGraph: {
        type: "website",
        locale: "zh_TW",
        siteName: "泡泡考卷",
        title: "考古題",
        description: "說明",
        url: "/past-exams",
        images: [OG_IMAGE],
      },
    });
  });
});

describe("jsonLdHtml", () => {
  it("cannot close the surrounding script tag", () => {
    const html = jsonLdHtml({ name: "</script><script>alert(1)</script>" });

    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
