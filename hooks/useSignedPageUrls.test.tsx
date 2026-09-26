import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { putPageImage, removePageImages, resetMockStore } from "../services/mockStore";
import { getPageImageUrls } from "../services/questionSourceService";
import { fetchSignedUrls, useSignedPageUrls } from "./useSignedPageUrls";

// 保留真正的實作，只多記錄呼叫，確認 hook 是透過 services 取網址。
vi.mock("../services/questionSourceService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/questionSourceService")>();
  return { ...actual, getPageImageUrls: vi.fn(actual.getPageImageUrls) };
});

let urlSequence = 0;

beforeEach(() => {
  // 先清掉上一個測試留下的頁圖，它們的 revoke 才不會記在這次的 mock 上。
  resetMockStore();
  urlSequence = 0;
  // jsdom 沒有 object URL；給每次建立一個可辨識的網址。
  URL.createObjectURL = vi.fn(() => `blob:page-${++urlSequence}`);
  URL.revokeObjectURL = vi.fn();
});

describe("fetchSignedUrls", () => {
  it("returns one reusable object url per stored page", async () => {
    putPageImage("a.jpg", new Blob(["a"]));
    putPageImage("b.jpg", new Blob(["b"]));

    expect(await fetchSignedUrls(["a.jpg", "b.jpg", "a.jpg"])).toEqual({
      "a.jpg": "blob:page-1",
      "b.jpg": "blob:page-2",
    });
    expect(await fetchSignedUrls(["a.jpg"], true)).toEqual({ "a.jpg": "blob:page-1" });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("asks the services layer and passes force along", async () => {
    putPageImage("a.jpg", new Blob(["a"]));
    expect(await fetchSignedUrls(["a.jpg"], true)).toEqual({ "a.jpg": "blob:page-1" });
    expect(getPageImageUrls).toHaveBeenLastCalledWith(["a.jpg"], true);
  });

  it("leaves out pages that are not stored", async () => {
    putPageImage("a.jpg", new Blob(["a"]));
    expect(await fetchSignedUrls(["a.jpg", "missing.jpg"])).toEqual({ "a.jpg": "blob:page-1" });
  });

  it("revokes the url when a page is replaced or removed", async () => {
    putPageImage("a.jpg", new Blob(["v1"]));
    await fetchSignedUrls(["a.jpg"]);

    putPageImage("a.jpg", new Blob(["v2"]));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:page-1");
    expect(await fetchSignedUrls(["a.jpg"])).toEqual({ "a.jpg": "blob:page-2" });

    removePageImages(["a.jpg"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:page-2");
    expect(await fetchSignedUrls(["a.jpg"])).toEqual({});
  });
});

describe("useSignedPageUrls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useSignedPageUrls> | null = null;

  function Probe({ paths }: { paths: string[] }) {
    const result = useSignedPageUrls(paths);
    useEffect(() => {
      latest = result;
    });
    return null;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("exposes urls for the requested paths and can refresh one", async () => {
    putPageImage("a.jpg", new Blob(["a"]));
    putPageImage("b.jpg", new Blob(["b"]));
    await act(async () => {
      root.render(<Probe paths={["a.jpg", "b.jpg"]} />);
    });
    expect(latest?.urls).toEqual({ "a.jpg": "blob:page-1", "b.jpg": "blob:page-2" });

    putPageImage("a.jpg", new Blob(["a2"]));
    await act(async () => {
      await latest?.refresh("a.jpg");
    });
    expect(getPageImageUrls).toHaveBeenLastCalledWith(["a.jpg"], true);
    expect(latest?.urls["a.jpg"]).toBe("blob:page-3");
    expect(latest?.urls["b.jpg"]).toBe("blob:page-2");
  });
});
