import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePage, makeQuestion, makeSource } from "../testing/questionBankFixtures";
import { commitEditorChanges, listBankQuestions } from "./bankQuestionService";
import { hasPageImage, mockStore, putPageImage, resetMockStore } from "./mockStore";
import {
  createQuestionSourcePath,
  createSource,
  deleteSource,
  getSource,
  listSources,
  newQuestionSourceId,
} from "./questionSourceService";

function rendered(width: number) {
  return { blob: new Blob(["jpeg"]), width, height: 200 };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:page");
  URL.revokeObjectURL = vi.fn();
  resetMockStore();
});

describe("paths and ids", () => {
  it("builds the page image path", () => {
    expect(createQuestionSourcePath("public", "s1", 3)).toBe("question-bank/public/s1/page-3.jpg");
  });

  it("creates distinct ids", () => {
    expect(newQuestionSourceId()).not.toBe(newQuestionSourceId());
  });
});

describe("createSource", () => {
  it("renders pages one at a time and stores the source after the last page", async () => {
    const order: string[] = [];
    const source = await createSource({
      sourceId: "s1",
      title: "月考",
      subject: "math",
      pageCount: 2,
      renderPage: async (index) => {
        order.push(`render ${index}`);
        expect(mockStore.sources.has("s1")).toBe(false);
        return rendered(100 + index);
      },
      onProgress: (uploaded, total) => order.push(`progress ${uploaded}/${total}`),
    });

    expect(order).toEqual(["render 0", "progress 1/2", "render 1", "progress 2/2"]);
    expect(source.pages).toEqual([
      { storagePath: "question-bank/public/s1/page-0.jpg", width: 100, height: 200, masks: [] },
      { storagePath: "question-bank/public/s1/page-1.jpg", width: 101, height: 200, masks: [] },
    ]);
    expect(await getSource("s1")).toEqual(source);
    expect(hasPageImage("question-bank/public/s1/page-1.jpg")).toBe(true);
  });

  it("removes stored pages and keeps no source when a page fails", async () => {
    await expect(
      createSource({
        sourceId: "s1",
        title: "月考",
        subject: "math",
        pageCount: 2,
        renderPage: async (index) => {
          if (index === 1) throw new Error("decode failed");
          return rendered(100);
        },
      }),
    ).rejects.toThrow("decode failed");

    expect(await getSource("s1")).toBeNull();
    expect(hasPageImage("question-bank/public/s1/page-0.jpg")).toBe(false);
  });

  it("overwrites the same id on retry", async () => {
    const input = { sourceId: "s1", title: "月考", subject: "math" as const, pageCount: 1 };
    await createSource({ ...input, renderPage: async () => rendered(100) });
    await createSource({ ...input, renderPage: async () => rendered(300) });
    expect(await listSources()).toHaveLength(1);
    expect((await getSource("s1"))?.pages[0].width).toBe(300);
  });
});

describe("reading sources", () => {
  it("lists newest first and returns copies", async () => {
    mockStore.sources.set("old", makeSource({ id: "old", createdAt: new Date("2026-09-01") }));
    mockStore.sources.set("new", makeSource({ id: "new", createdAt: new Date("2026-09-20") }));

    const listed = await listSources();
    expect(listed.map((source) => source.id)).toEqual(["new", "old"]);

    listed[0].title = "changed";
    expect((await getSource("new"))?.title).toBe("四上數學月考");
  });

  it("returns null for a missing source", async () => {
    expect(await getSource("nope")).toBeNull();
  });
});

describe("deleteSource", () => {
  it("removes its questions, the source and its page images", async () => {
    const page = makePage({ storagePath: "question-bank/public/source-1/page-0.jpg" });
    const source = makeSource({ pages: [page] });
    mockStore.sources.set(source.id, source);
    putPageImage(page.storagePath, new Blob(["jpeg"]));
    await commitEditorChanges({
      upserts: [makeQuestion({ id: "q1" }), makeQuestion({ id: "q2", sourceId: "other" })],
      deleteIds: [],
      source: null,
    });

    await deleteSource(source);

    expect(await getSource(source.id)).toBeNull();
    expect((await listBankQuestions()).map((question) => question.id)).toEqual(["q2"]);
    expect(hasPageImage(page.storagePath)).toBe(false);
  });
});
