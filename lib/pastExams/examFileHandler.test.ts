// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOutputCatalog } from "../../scripts/examCatalog";
import { writeFakeOutput } from "../../testing/fakeExamOutput";
import { handleExamFileRequest, type ExamFileHandlerDeps } from "./examFileHandler";
import { createExamFileLookup, type ExamFileEntry } from "./examIndex";
import { blobExamFileSource, examFileSourceFromEnv, localExamFileSource, type GetPrivateBlob } from "./fileSources";

const ORIGIN = "http://localhost:6789";
let root: string;
let outputDir: string;
let findFile: (file: string) => ExamFileEntry | undefined;

function request(path: string, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }): Request {
  return new Request(`${ORIGIN}/exams/${path}`, { headers });
}

function localDeps(): ExamFileHandlerDeps {
  return { findFile, source: localExamFileSource(outputDir) };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "exam-files-"));
  outputDir = join(root, "output");
  await writeFakeOutput(outputDir, [
    {
      id: "a",
      path: "pdf/ds/a.pdf",
      title: "114上｜臺北市 民權國小｜期中1",
      content: "%PDF-a",
      answer: { path: "pdf/ds/answers/a.pdf", content: "%PDF-answer" },
    },
    { id: "b", path: "pdf/ds/b.pdf", downloaded: false },
    { id: "c", path: "doc/ds/c.docx", content: "docx" },
    { id: "d", path: "pdf/ds/考卷 1.pdf", content: "%PDF-d" },
  ]);
  findFile = createExamFileLookup((await readOutputCatalog(outputDir)).exams);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("handleExamFileRequest with output/", () => {
  it("serves a catalogued PDF inline with protective headers", async () => {
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], localDeps());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-a");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe("6");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="a.pdf"; filename*=UTF-8''${encodeURIComponent("114上｜臺北市 民權國小｜期中考.pdf")}`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect([...response.headers.keys()].some((key) => key.startsWith("access-control"))).toBe(false);
  });

  it("serves the answer sheet with 解答 in its download name", async () => {
    const response = await handleExamFileRequest(
      request("pdf/ds/answers/a.pdf?download=1"),
      ["pdf", "ds", "answers", "a.pdf"],
      localDeps(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-answer");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="a.pdf"; filename*=UTF-8''${encodeURIComponent("114上｜臺北市 民權國小｜期中考（解答）.pdf")}`,
    );
  });

  it("sends an attachment for ?download=1", async () => {
    const response = await handleExamFileRequest(request("doc/ds/c.docx?download=1"), ["doc", "ds", "c.docx"], localDeps());

    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="c\.docx"; /);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("serves files whose names Next.js hands over decoded", async () => {
    const response = await handleExamFileRequest(
      request("pdf/ds/%E8%80%83%E5%8D%B7%201.pdf"),
      ["pdf", "ds", "考卷 1.pdf"],
      localDeps(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-d");
  });

  it.each([
    ["not in the catalog", ["catalog.jsonl"]],
    ["unknown", ["pdf", "ds", "zzz.pdf"]],
    ["not downloaded", ["pdf", "ds", "b.pdf"]],
    ["escaping output/", ["..", "catalog.jsonl"]],
  ])("returns 404 for a file %s", async (_label, segments) => {
    const response = await handleExamFileRequest(request(segments.join("/")), segments, localDeps());
    expect(response.status).toBe(404);
  });

  it("returns 404 when a catalogued file is missing on disk", async () => {
    await rm(join(outputDir, "pdf", "ds", "a.pdf"));
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], localDeps());
    expect(response.status).toBe(404);
  });

  it.each([
    [{ "sec-fetch-site": "cross-site" }],
    [{ "sec-fetch-site": "none" }],
    [{ referer: "https://evil.example/page" }],
    [{}],
  ])("serves catalogued files for external and direct requests (%o)", async (headers) => {
    for (const segments of [["pdf", "ds", "a.pdf"], ["pdf", "ds", "answers", "a.pdf"]]) {
      const response = await handleExamFileRequest(request(segments.join("/"), headers), segments, localDeps());
      expect(response.status).toBe(200);
      expect(await response.text()).toMatch(/^%PDF-/);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });
});

describe("handleExamFileRequest with private Blob", () => {
  function blobDeps(getBlob: GetPrivateBlob): ExamFileHandlerDeps {
    return { findFile, source: blobExamFileSource(getBlob) };
  }

  it("streams the blob stored at exams/<relative_path>", async () => {
    const getBlob = vi.fn<GetPrivateBlob>(async () => ({
      statusCode: 200 as const,
      stream: new Response("%PDF-blob").body!,
      blob: { etag: '"e1"', size: 9 },
    }));

    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], blobDeps(getBlob));

    expect(getBlob).toHaveBeenCalledWith("exams/pdf/ds/a.pdf", { access: "private" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-blob");
    expect(response.headers.get("etag")).toBe('"e1"');
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
  });

  it("passes the browser's ETag through and answers 304", async () => {
    const getBlob = vi.fn<GetPrivateBlob>(async () => ({ statusCode: 304 as const, blob: { etag: '"e1"' } }));

    const response = await handleExamFileRequest(
      request("pdf/ds/a.pdf", { "sec-fetch-site": "same-origin", "if-none-match": '"e1"' }),
      ["pdf", "ds", "a.pdf"],
      blobDeps(getBlob),
    );

    expect(getBlob).toHaveBeenCalledWith("exams/pdf/ds/a.pdf", { access: "private", ifNoneMatch: '"e1"' });
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"e1"');
    expect(await response.text()).toBe("");
  });

  it("returns 404 when the blob is missing", async () => {
    const getBlob = vi.fn<GetPrivateBlob>(async () => null);
    const response = await handleExamFileRequest(request("pdf/ds/a.pdf"), ["pdf", "ds", "a.pdf"], blobDeps(getBlob));
    expect(response.status).toBe(404);
  });
});

describe("examFileSourceFromEnv", () => {
  it("reads Blob only when EXAMS_FILE_SOURCE is blob", () => {
    const getBlob = vi.fn<GetPrivateBlob>();
    expect(examFileSourceFromEnv({ EXAMS_FILE_SOURCE: "blob" }, { outputDir, getBlob }).cacheControl).toBe("private, no-cache");
    expect(examFileSourceFromEnv({ EXAMS_FILE_SOURCE: "local" }, { outputDir, getBlob }).cacheControl).toBe("no-store");
    expect(examFileSourceFromEnv({}, { outputDir, getBlob }).cacheControl).toBe("no-store");
  });
});
