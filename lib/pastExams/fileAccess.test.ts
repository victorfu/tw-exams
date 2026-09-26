// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./fileAccess";

const url = "https://tw-exams.vercel.app/exams/pdf/ds/a.pdf";

describe("isSameOriginRequest", () => {
  it("accepts requests from the site's own pages", () => {
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-origin" }), url)).toBe(true);
  });

  it.each(["none", "same-site", "cross-site"])("rejects Sec-Fetch-Site %s even with a same-origin Referer", (site) => {
    const headers = new Headers({ "sec-fetch-site": site, referer: "https://tw-exams.vercel.app/past-exams" });
    expect(isSameOriginRequest(headers, url)).toBe(false);
  });

  it("falls back to a same-origin Referer when Sec-Fetch-Site is missing", () => {
    expect(isSameOriginRequest(new Headers({ referer: "https://tw-exams.vercel.app/past-exams?id=1" }), url)).toBe(true);
  });

  it.each([["https://evil.example/page"], ["not a url"]])("rejects a Referer %s", (referer) => {
    expect(isSameOriginRequest(new Headers({ referer }), url)).toBe(false);
  });

  it("rejects when neither header is present", () => {
    expect(isSameOriginRequest(new Headers(), url)).toBe(false);
  });
});
