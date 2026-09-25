import { beforeEach, describe, expect, it } from "vitest";
import {
  createSheet,
  deleteSheet,
  getSheet,
  listSheets,
  updateSheet,
} from "./examSheetService";
import { resetMockStore } from "./mockStore";

beforeEach(() => {
  resetMockStore();
});

describe("examSheetService", () => {
  it("creates, reads, updates and deletes a sheet", async () => {
    const ids = ["q1", "q2"];
    const created = await createSheet({ title: "期中考複習", questionIds: ids });
    ids.push("q3");
    expect(created.questionIds).toEqual(["q1", "q2"]);
    expect(await getSheet(created.id)).toEqual(created);

    await updateSheet(created.id, { title: "改名", questionIds: ["q2"] });
    expect(await getSheet(created.id)).toMatchObject({ title: "改名", questionIds: ["q2"] });

    await deleteSheet(created.id);
    expect(await getSheet(created.id)).toBeNull();
  });

  it("lists newest first", async () => {
    const first = await createSheet({ title: "一", questionIds: [] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createSheet({ title: "二", questionIds: [] });
    expect((await listSheets()).map((sheet) => sheet.id)).toEqual([second.id, first.id]);
  });

  it("rejects updating a missing sheet", async () => {
    await expect(updateSheet("gone", { title: "x", questionIds: [] })).rejects.toThrow();
  });
});
