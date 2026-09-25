import { beforeEach, describe, expect, it } from "vitest";
import { makeQuestion, makeSource } from "../testing/questionBankFixtures";
import {
  commitEditorChanges,
  deleteQuestionsForSource,
  listBankQuestions,
  listQuestionsForSource,
  newBankQuestionId,
} from "./bankQuestionService";
import { mockStore, resetMockStore } from "./mockStore";

beforeEach(() => {
  resetMockStore();
});

describe("commitEditorChanges", () => {
  it("upserts, deletes and updates the source", async () => {
    mockStore.sources.set("source-1", makeSource());
    await commitEditorChanges({
      upserts: [makeQuestion({ id: "q1" }), makeQuestion({ id: "q2" })],
      deleteIds: [],
      source: null,
    });

    const masks = [{ x: 0, y: 0, w: 0.5, h: 0.5 }];
    await commitEditorChanges({
      upserts: [makeQuestion({ id: "q1", answer: "42" })],
      deleteIds: ["q2"],
      source: {
        id: "source-1",
        title: "改名",
        pages: [{ ...makeSource().pages[0], masks }],
      },
    });

    const questions = await listBankQuestions();
    expect(questions.map((question) => [question.id, question.answer])).toEqual([["q1", "42"]]);
    const source = mockStore.sources.get("source-1");
    expect(source?.title).toBe("改名");
    expect(source?.pages[0].masks).toEqual(masks);
  });

  it("drops blank answers and stamps updatedAt", async () => {
    const before = new Date("2026-01-01T00:00:00Z");
    await commitEditorChanges({
      upserts: [makeQuestion({ id: "q1", answer: "   ", updatedAt: before })],
      deleteIds: [],
      source: null,
    });
    const [stored] = await listBankQuestions();
    expect("answer" in stored).toBe(false);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("does not share objects with the caller", async () => {
    const question = makeQuestion({ id: "q1" });
    await commitEditorChanges({ upserts: [question], deleteIds: [], source: null });
    question.regions[0].box.x = 0.9;
    expect((await listBankQuestions())[0].regions[0].box.x).toBe(0.1);
  });

  it("rejects a source update for a missing source", async () => {
    await expect(
      commitEditorChanges({
        upserts: [],
        deleteIds: [],
        source: { id: "gone", title: "x", pages: [] },
      }),
    ).rejects.toThrow();
  });
});

describe("per-source queries", () => {
  it("lists and deletes only that source's questions", async () => {
    await commitEditorChanges({
      upserts: [
        makeQuestion({ id: "a1", sourceId: "a" }),
        makeQuestion({ id: "b1", sourceId: "b" }),
      ],
      deleteIds: [],
      source: null,
    });
    expect((await listQuestionsForSource("a")).map((question) => question.id)).toEqual(["a1"]);

    await deleteQuestionsForSource("a");
    expect((await listBankQuestions()).map((question) => question.id)).toEqual(["b1"]);
  });

  it("creates distinct ids", () => {
    expect(newBankQuestionId()).not.toBe(newBankQuestionId());
  });
});
