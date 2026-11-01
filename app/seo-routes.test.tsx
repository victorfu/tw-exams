import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { examPath } from "@/lib/pastExams/examPage";
import { absoluteUrl } from "@/lib/site";
import sitemap from "./sitemap";
import robots from "./robots";
import ExamPage, { generateStaticParams, generateMetadata } from "./(site)/past-exams/[collection]/[exam]/page";
import CollectionPage from "./(site)/past-exams/[collection]/page";
import Guide from "./(site)/guides/practice-sheets/page";
import { metadata as workspaceMetadata } from "./(app)/my-exams/layout";

describe("SEO route contracts", () => {
  const available = pastExamCatalog.exams.filter((exam) => exam.available);

  it("includes every public exam exactly once, with no workspace or query URLs", () => {
    const urls = sitemap().map((item) => item.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const exam of available) expect(urls).toContain(absoluteUrl(examPath(exam)));
    expect(urls.some((url) => url.includes("/my-exams") || url.includes("?"))).toBe(false);
    expect(urls).toContain(absoluteUrl("/guides/practice-sheets"));
    expect(generateStaticParams()).toHaveLength(available.length);
    expect(workspaceMetadata.robots).toEqual({ index: false, follow: true });
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/", disallow: "/exams/" });
  });

  it("renders source, facts, matching schema, downloads and canonical without client JS", async () => {
    for (const exam of [available.find((exam) => exam.answer)!, available.find((exam) => !exam.answer)!, available.find((exam) => exam.format === "word")!]) {
      const props = { params: Promise.resolve({ collection: exam.datasetId, exam: exam.id }), searchParams: Promise.resolve({}) };
      const html = renderToStaticMarkup(await ExamPage(props));
      const doc = new DOMParser().parseFromString(html, "text/html");
      expect(doc.querySelectorAll("h1")).toHaveLength(1);
      expect(doc.body.textContent).toContain(exam.school);
      expect(doc.querySelector("a[href='" + exam.source?.url + "']")).not.toBeNull();
      expect(doc.querySelector("time")?.getAttribute("datetime")).toBe(exam.source?.collectedAt);
      const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"];
      expect(graph[0].name).toBe(doc.querySelector("h1")?.textContent);
      expect(graph[0].url).toBe(absoluteUrl(examPath(exam)));
      expect(doc.body.textContent?.includes("下載解答卷")).toBe(Boolean(exam.answer));
      expect((await generateMetadata(props)).alternates?.canonical).toBe(examPath(exam));
    }
  });

  it("rejects unknown and cross-collection exam IDs", async () => {
    await expect(ExamPage({ params: Promise.resolve({ collection: "wrong", exam: available[0].id }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("accepts Next's percent-encoded prerender params and rejects malformed encoding", async () => {
    const exam = available[0];
    const params = Promise.resolve({ collection: exam.datasetId, exam: encodeURIComponent(exam.id) });
    expect((await generateMetadata({ params, searchParams: Promise.resolve({}) })).alternates?.canonical).toBe(examPath(exam));
    await expect(ExamPage({ params: Promise.resolve({ collection: exam.datasetId, exam: "%GG" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("renders a crawlable collection list matching its structured data", async () => {
    const collection = pastExamCatalog.datasets[0];
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(await CollectionPage({ params: Promise.resolve({ collection: collection.id }), searchParams: Promise.resolve({}) })), "text/html");
    const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"];
    const list = graph[0].mainEntity;
    expect(list.itemListElement).toHaveLength(list.numberOfItems);
    for (const item of list.itemListElement) {
      expect(doc.querySelector(`a[href="${new URL(item.url).pathname}"]`)).not.toBeNull();
    }
  });

  it("exposes the guide and its storage/answer limitations as server HTML", () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<Guide />), "text/html");
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.body.textContent).toContain("不是每份考卷都有解答");
    expect(doc.body.textContent).toContain("重新整理、關閉分頁或另開分頁");
    for (const collection of pastExamCatalog.datasets) expect(doc.querySelector(`a[href="/past-exams/${collection.id}"]`)).not.toBeNull();
  });
});
