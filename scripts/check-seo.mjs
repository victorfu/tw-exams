import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

// Run against `npm start`, not next dev: validate the actual production HTML and status codes.
const base = new URL(process.argv[2] || "http://localhost:6789");
const catalog = JSON.parse(await readFile(new URL("../data/pastExams.json", import.meta.url), "utf8"));
const available = catalog.exams.filter((exam) => exam.available);
const examPath = (exam) => `/past-exams/${encodeURIComponent(exam.datasetId)}/${encodeURIComponent(exam.id)}`;
let requests = 0;

async function request(path, status = 200, userAgent = "OAI-SearchBot") {
  const response = await fetch(new URL(path, base), { headers: { "user-agent": userAgent }, redirect: "manual" });
  assert.equal(response.status, status, `${path}: HTTP status`);
  requests++;
  return response.text();
}

async function html(path, canonical, { noindex = false, userAgent } = {}) {
  const doc = new JSDOM(await request(path, 200, userAgent)).window.document;
  assert.ok(doc.querySelector("title")?.textContent, `${path}: title`);
  assert.ok(doc.querySelector('meta[name="description"]')?.content, `${path}: description`);
  const robots = doc.querySelector('meta[name="robots"]')?.content || "";
  assert.equal(robots.includes("noindex"), noindex, `${path}: robots`);
  const actual = doc.querySelector('link[rel="canonical"]')?.href;
  if (canonical) {
    assert.ok(actual, `${path}: canonical exists`);
    assert.equal(new URL(actual).pathname, canonical, `${path}: canonical path`);
    assert.equal(new URL(actual).search, "", `${path}: canonical has no query`);
    assert.ok(doc.querySelector('meta[property="og:title"]')?.content, `${path}: OG title`);
    assert.ok(doc.querySelector('meta[name="twitter:title"]')?.content, `${path}: Twitter title`);
  } else assert.equal(actual, undefined, `${path}: no unrelated canonical`);
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(script.textContent);
  return doc;
}

const sitemap = new JSDOM(await request("/sitemap.xml"), { contentType: "application/xml" }).window.document;
const verificationFile = "googlef5650c4c1be55237.html";
assert.equal(await request(`/${verificationFile}`), await readFile(new URL(`../public/${verificationFile}`, import.meta.url), "utf8"), "Search Console verification file is served verbatim");
const locs = [...sitemap.querySelectorAll("loc")].map((node) => node.textContent);
assert.equal(new Set(locs).size, locs.length, "Sitemap URLs are unique");
assert.ok(locs.length > 0, "Sitemap is not empty");
assert.ok(locs.every((url) => !url.includes("/my-exams") && !new URL(url).search), "Sitemap contains no workspace or query URLs");
const sitemapOrigin = new URL(locs[0]).origin;
for (const exam of available) assert.ok(locs.includes(sitemapOrigin + examPath(exam)), `Missing exam ${exam.id}`);

await html("/", "/");
const guide = await html("/guides/practice-sheets", "/guides/practice-sheets");
assert.ok(guide.body.textContent.includes("重新整理、關閉分頁或另開分頁"), "Guide contains storage limitations");
await html("/my-exams", "/my-exams", { noindex: true });
await html("/past-exams", "/past-exams");
await html("/past-exams?q=test", null, { noindex: true });
await html("/past-exams?c=missing", null, { noindex: true });

const samples = [available.find((exam) => exam.answer), available.find((exam) => !exam.answer), available.find((exam) => exam.format === "word")].filter(Boolean);
for (const exam of samples) {
  const path = examPath(exam);
  const doc = await html(path, path);
  assert.equal(doc.querySelectorAll("h1").length, 1, `${path}: one H1`);
  assert.ok(doc.body.textContent.includes(exam.school || "學校未提供"), `${path}: school in HTML`);
  assert.equal(doc.body.textContent.includes("下載解答卷"), Boolean(exam.answer), `${path}: answer availability`);
  if (exam.source?.url) assert.ok([...doc.querySelectorAll("a")].some((a) => a.href === exam.source.url), `${path}: source link`);
  const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)["@graph"];
  assert.equal(graph[0].name, doc.querySelector("h1").textContent, `${path}: schema matches visible title`);
  assert.equal(graph[0].url, sitemapOrigin + path, `${path}: schema URL`);
  for (const agent of ["OAI-SearchBot", "Googlebot", "bingbot"]) {
    await html(`/past-exams?${new URLSearchParams({ c: exam.datasetId, id: exam.id })}`, path, { userAgent: agent });
  }
}
// Membership alone cannot detect a generated page that accidentally contains a 404.
// Check every public exam over HTTP, in small batches, without retaining parsed DOMs.
const sampledIds = new Set(samples.map((exam) => exam.id));
const remaining = available.filter((exam) => !sampledIds.has(exam.id));
for (let i = 0; i < remaining.length; i += 16) {
  await Promise.all(remaining.slice(i, i + 16).map(async (exam) => {
    const path = examPath(exam);
    const markup = await request(path);
    assert.ok(markup.includes("<h1"), `${path}: server-rendered heading`);
    assert.ok(!markup.includes('id="__next_error__"'), `${path}: no prerender error`);
    const canonical = markup.match(/<link rel="canonical" href="([^"]+)"/);
    assert.equal(canonical?.[1], sitemapOrigin + path, `${path}: canonical`);
  }));
}
for (const collection of catalog.datasets) {
  const path = `/past-exams/${collection.id}`;
  const doc = await html(path, path);
  const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)["@graph"];
  const items = graph[0].mainEntity.itemListElement;
  const hrefs = new Set([...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
  for (const item of items) assert.ok(hrefs.has(new URL(item.url).pathname), `${path}: schema item linked in HTML`);
  await html(`/past-exams?${new URLSearchParams({ c: collection.id })}`, path);
}
await request("/past-exams/missing", 404);
await request(`/past-exams/${available[0].datasetId}/missing`, 404);
const other = catalog.datasets.find((item) => item.id !== available[0].datasetId);
if (other) await request(`/past-exams/${other.id}/${encodeURIComponent(available[0].id)}`, 404);
const robots = await request("/robots.txt");
assert.ok(robots.includes(`Sitemap: ${sitemapOrigin}/sitemap.xml`), "Robots points to canonical sitemap");
assert.ok(!robots.includes("Disallow: /my-exams"), "Workspace noindex is crawlable");
assert.ok((await request("/llms.txt")).includes(`${sitemapOrigin}/guides/practice-sheets`), "AI summary links to public guide");
console.log(`SEO smoke passed: ${requests} HTTP responses, ${locs.length} sitemap URLs, ${available.length} exam pages; no browser JavaScript executed.`);
