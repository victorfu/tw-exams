import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutosaveQueue,
  type AutosaveStatus,
  type PendingChanges,
} from "./autosaveQueue";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup(persistedIds: string[] = []) {
  const commits: PendingChanges[] = [];
  const statuses: AutosaveStatus[] = [];
  let next: () => Promise<void> = async () => {};
  const queue = new AutosaveQueue({
    commit: (changes) => {
      commits.push(changes);
      return next();
    },
    persistedIds,
    delayMs: 1000,
    onStatusChange: (status) => statuses.push(status),
  });
  return {
    queue,
    commits,
    statuses,
    willCommit: (impl: () => Promise<void>) => {
      next = impl;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveQueue", () => {
  it("debounces changes into one commit", async () => {
    const { queue, commits, statuses } = setup();
    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(500);
    queue.markUpsert("b");
    await vi.advanceTimersByTimeAsync(999);
    expect(commits).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(commits).toEqual([{ upsertIds: ["a", "b"], deleteIds: [], sourceDirty: false }]);
    expect(statuses).toEqual(["saving", "saved"]);
    expect(queue.hasPending()).toBe(false);
  });

  it("sends nothing for a question created and deleted before saving", async () => {
    const { queue, commits } = setup();
    queue.markUpsert("draft");
    queue.markDelete("draft");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(0);
  });

  it("deletes questions that already exist in Firestore", async () => {
    const { queue, commits } = setup(["saved-1"]);
    queue.markUpsert("saved-1");
    queue.markDelete("saved-1");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toEqual([{ upsertIds: [], deleteIds: ["saved-1"], sourceDirty: false }]);
  });

  it("reports source changes", async () => {
    const { queue, commits } = setup();
    queue.markSourceDirty();
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toEqual([{ upsertIds: [], deleteIds: [], sourceDirty: true }]);
  });

  it("queues changes made while a commit is in flight for the next batch", async () => {
    const { queue, commits, willCommit } = setup();
    const inFlight = deferred();
    willCommit(() => inFlight.promise);

    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(1);

    willCommit(async () => {});
    queue.markUpsert("a"); // 送出期間又改了一次
    queue.markUpsert("b");
    inFlight.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    expect(commits[1]).toEqual({ upsertIds: ["a", "b"], deleteIds: [], sourceDirty: false });
  });

  it("deletes a new question that was removed while its first save was in flight", async () => {
    const { queue, commits, willCommit } = setup();
    const inFlight = deferred();
    willCommit(() => inFlight.promise);

    queue.markUpsert("fresh");
    await vi.advanceTimersByTimeAsync(1000);
    willCommit(async () => {});
    queue.markDelete("fresh");
    inFlight.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    expect(commits[1]).toEqual({ upsertIds: [], deleteIds: ["fresh"], sourceDirty: false });
  });

  it("keeps everything after a failure and resends on the next flush", async () => {
    const { queue, commits, statuses, willCommit } = setup();
    willCommit(async () => {
      throw new Error("offline");
    });
    queue.markUpsert("a");
    queue.markSourceDirty();
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");
    expect(queue.hasPending()).toBe(true);

    willCommit(async () => {});
    await queue.flush();
    expect(commits[1]).toEqual({ upsertIds: ["a"], deleteIds: [], sourceDirty: true });
    expect(statuses.at(-1)).toBe("saved");
  });

  it("flush() saves immediately without waiting for the debounce", async () => {
    const { queue, commits } = setup();
    queue.markUpsert("a");
    await queue.flush();
    expect(commits).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(1);
  });

  it("stop() cancels the scheduled save and start() resumes scheduling", async () => {
    const { queue, commits } = setup();
    queue.markUpsert("a");
    queue.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(commits).toHaveLength(0);

    queue.start();
    queue.markUpsert("b");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toEqual([{ upsertIds: ["a", "b"], deleteIds: [], sourceDirty: false }]);
  });

  it("drops the delete for a question that never finished saving, after a failed commit", async () => {
    const { queue, commits, statuses, willCommit } = setup();
    willCommit(async () => {
      throw new Error("offline");
    });
    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");

    willCommit(async () => {});
    queue.markDelete("a");
    await vi.advanceTimersByTimeAsync(1000);

    // "a" was never written, so there is nothing left to send: no upsert
    // (removed by markDelete) and no delete (it would target a document
    // that doesn't exist, which Firestore's rules reject and fails the batch).
    expect(commits).toHaveLength(1);
    expect(queue.hasPending()).toBe(false);
  });

  it("sends no delete for a new question whose first commit fails while it is being deleted", async () => {
    const { queue, commits, willCommit } = setup();
    const inFlight = deferred();
    willCommit(() => inFlight.promise);

    queue.markUpsert("fresh");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(1);

    willCommit(async () => {});
    queue.markDelete("fresh"); // deleted while its first save is still in flight
    inFlight.reject(new Error("offline"));
    await vi.advanceTimersByTimeAsync(1000);

    // The in-flight commit failed, so "fresh" was never persisted: no
    // second commit should be sent for it.
    expect(commits).toHaveLength(1);
    expect(queue.hasPending()).toBe(false);
  });

  it("commits normally again after a failure that dropped a stale delete", async () => {
    const { queue, commits, statuses, willCommit } = setup();
    willCommit(async () => {
      throw new Error("offline");
    });
    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");

    willCommit(async () => {});
    queue.markDelete("a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(1); // still nothing sent for "a"

    queue.markUpsert("b");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits.at(-1)).toEqual({ upsertIds: ["b"], deleteIds: [], sourceDirty: false });
    expect(statuses.at(-1)).toBe("saved");
  });

  it("clears the error once a failed batch leaves nothing to resend (in-flight delete)", async () => {
    const { queue, commits, statuses, willCommit } = setup();
    const inFlight = deferred();
    willCommit(() => inFlight.promise);

    queue.markUpsert("fresh");
    await vi.advanceTimersByTimeAsync(1000);
    queue.markDelete("fresh"); // deleted while its first save is still in flight
    inFlight.reject(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)).toBe("error");
    expect(queue.hasPending()).toBe(false);

    // markDelete 排的那次儲存（或按「重試」）發現沒東西要送：不該一直停在錯誤
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("saved");
    expect(commits).toHaveLength(1);
  });

  it("lets retry clear the error when the unsaved question was deleted after the failure", async () => {
    const { queue, commits, statuses, willCommit } = setup();
    willCommit(async () => {
      throw new Error("offline");
    });
    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");

    queue.markDelete("a");
    queue.stop(); // 不靠計時器，直接按「重試」
    await queue.flush();

    expect(statuses.at(-1)).toBe("saved");
    expect(commits).toHaveLength(1);
  });

  it("does not report saved for a flush with nothing to save when nothing failed", async () => {
    const { queue, statuses } = setup();
    await queue.flush();
    expect(statuses).toEqual([]);
  });

  it("synchronously throwing commit sets error status and keeps changes pending", async () => {
    const { queue, statuses } = setup();
    queue.markUpsert("a");
    const syncThrow = () => {
      throw new Error("sync error");
    };
    queue.setCommit(syncThrow as unknown as (changes: PendingChanges) => Promise<void>);

    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");
    expect(queue.hasPending()).toBe(true);
  });
});


it("flushAndWait drains edits made during an in-flight save and reports failures", async () => {
  const { queue, commits, willCommit } = setup();
  const flight = deferred();
  willCommit(() => flight.promise);
  queue.markUpsert("a");
  const saving = queue.flushAndWait();
  queue.markUpsert("b");
  flight.resolve();
  expect(await saving).toBe(true);
  expect(commits).toHaveLength(2);
  willCommit(async () => { throw new Error("offline"); });
  queue.markUpsert("c");
  expect(await queue.flushAndWait()).toBe(false);
  expect(queue.hasPending()).toBe(true);
  willCommit(async () => {});
  expect(await queue.flushAndWait()).toBe(true);
  expect(queue.hasPending()).toBe(false);
});
