// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFakeOutput } from "../testing/fakeExamOutput";
import { hasBlobCredentials, listAllBlobs, uploadExams, type BlobClient, type RemoteBlob } from "./uploadExams";

let root: string;
let outputDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "upload-exams-"));
  outputDir = join(root, "output");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function blob(pathname: string, size: number): RemoteBlob {
  return { pathname, size, url: `https://store.private.blob.vercel-storage.com/${pathname}` };
}

function fakeClient(remote: RemoteBlob[] = [], requests = 1) {
  const puts: { pathname: string; body: string; contentType: string }[] = [];
  const deleted: string[][] = [];
  const client: BlobClient = {
    listAll: vi.fn(async () => ({ blobs: remote, requests })),
    put: vi.fn(async (pathname: string, body: Buffer, contentType: string) => {
      puts.push({ pathname, body: body.toString(), contentType });
    }),
    del: vi.fn(async (urls: string[]) => {
      deleted.push(urls);
    }),
  };
  return { client, puts, deleted };
}

const quiet = () => {};

describe("uploadExams", () => {
  beforeEach(async () => {
    await writeFakeOutput(outputDir, [
      { id: "a", path: "pdf/ds/a.pdf", content: "aaaa" },
      { id: "b", path: "pdf/ds/b.pdf", content: "bbbb" },
      { id: "c", path: "doc/ds/c.docx", content: "cc" },
      { id: "d", path: "pdf/ds/d.pdf", downloaded: false },
    ]);
  });

  it("uploads missing and changed files and skips unchanged ones", async () => {
    const { client, puts, deleted } = fakeClient([
      blob("exams/pdf/ds/a.pdf", 4),
      blob("exams/pdf/ds/b.pdf", 99),
      blob("exams/pdf/ds/old.pdf", 1),
    ]);

    const summary = await uploadExams({ outputDir, client, log: quiet });

    expect(summary.planned.skip).toEqual(["pdf/ds/a.pdf"]);
    expect(puts.sort((x, y) => x.pathname.localeCompare(y.pathname))).toEqual([
      {
        pathname: "exams/doc/ds/c.docx",
        body: "cc",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      { pathname: "exams/pdf/ds/b.pdf", body: "bbbb", contentType: "application/pdf" },
    ]);
    expect(summary.planned.stale.map((item) => item.pathname)).toEqual(["exams/pdf/ds/old.pdf"]);
    expect(summary.uploaded).toBe(2);
    expect(deleted).toEqual([]);
  });

  it("changes nothing on --dry-run", async () => {
    const { client, puts } = fakeClient();

    const summary = await uploadExams({ outputDir, client, dryRun: true, log: quiet });

    expect(puts).toEqual([]);
    expect(summary.planned.upload).toHaveLength(3);
    expect(summary.operations).toBe(4);
  });

  it("deletes stale blobs only with --prune", async () => {
    const { client, deleted } = fakeClient([blob("exams/pdf/ds/old.pdf", 1)]);

    const summary = await uploadExams({ outputDir, client, prune: true, log: quiet });

    expect(deleted).toEqual([["https://store.private.blob.vercel-storage.com/exams/pdf/ds/old.pdf"]]);
    expect(summary.deleted).toBe(1);
  });

  it("uploads nothing when a local file does not match the catalog size", async () => {
    await writeFakeOutput(outputDir, [
      { id: "a", path: "pdf/ds/a.pdf", content: "aaaa" },
      { id: "b", path: "pdf/ds/b.pdf", content: "bbbb", bytes: 999 },
    ]);
    const { client, puts } = fakeClient();

    await expect(uploadExams({ outputDir, client, log: quiet })).rejects.toThrow(/pdf\/ds\/b\.pdf.*999/);
    expect(client.listAll).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("uploads nothing when a downloaded file is missing locally", async () => {
    await rm(join(outputDir, "pdf", "ds", "a.pdf"));
    const { client, puts } = fakeClient();

    await expect(uploadExams({ outputDir, client, log: quiet })).rejects.toThrow(/pdf\/ds\/a\.pdf/);
    expect(puts).toEqual([]);
  });

  it("explains how to refresh credentials when the store cannot be read", async () => {
    const { client } = fakeClient();
    vi.mocked(client.listAll).mockRejectedValueOnce(new Error("Access denied, please provide a valid token"));

    await expect(uploadExams({ outputDir, client, log: quiet })).rejects.toThrow(/vercel env pull/);
  });

  it("warns when the run would use most of the monthly operations", async () => {
    const { client } = fakeClient([], 1500);
    const lines: string[] = [];

    await uploadExams({ outputDir, client, dryRun: true, log: (line) => lines.push(line) });

    expect(lines.some((line) => line.startsWith("⚠"))).toBe(true);
  });

  it("reports a failed upload without stopping the others", async () => {
    const { client } = fakeClient();
    vi.mocked(client.put).mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const summary = await uploadExams({ outputDir, client, log: quiet });

    expect(summary.failed).toHaveLength(1);
    expect(summary.uploaded).toBe(2);
  });
});

describe("listAllBlobs", () => {
  it("follows cursors until the last page", async () => {
    const pages = {
      first: { blobs: [blob("exams/a", 1)], cursor: "c1", hasMore: true },
      c1: { blobs: [blob("exams/b", 1)], cursor: "c2", hasMore: true },
      c2: { blobs: [blob("exams/c", 1)], hasMore: false },
    };
    const listPage = vi.fn(async (cursor: string | undefined) => pages[(cursor ?? "first") as keyof typeof pages]);

    const result = await listAllBlobs(listPage);

    expect(result.blobs.map((item) => item.pathname)).toEqual(["exams/a", "exams/b", "exams/c"]);
    expect(result.requests).toBe(3);
    expect(listPage.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, "c1", "c2"]);
  });
});

describe("hasBlobCredentials", () => {
  it.each([
    [{ VERCEL_OIDC_TOKEN: "t", BLOB_STORE_ID: "s" }, true],
    [{ BLOB_READ_WRITE_TOKEN: "rw" }, true],
    [{ VERCEL_OIDC_TOKEN: "t" }, false],
    [{}, false],
  ])("%o → %s", (env, expected) => {
    expect(hasBlobCredentials(env)).toBe(expected);
  });
});
