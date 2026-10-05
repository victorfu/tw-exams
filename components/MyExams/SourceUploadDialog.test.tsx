import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageInput, RenderedPage } from "../../utils/pageImageProcessor";

const mocks = vi.hoisted(() => ({
  expandFilesToPages: vi.fn(),
  renderPage: vi.fn(),
  releasePdfFiles: vi.fn(async () => {}),
  createSource: vi.fn(),
}));

// 真正的縮圖與上傳要 canvas、pdf.js；這裡只控制它們什麼時候完成。
vi.mock("../../utils/pageImageProcessor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/pageImageProcessor")>()),
  expandFilesToPages: mocks.expandFilesToPages,
  renderPage: mocks.renderPage,
  releasePdfFiles: mocks.releasePdfFiles,
}));
vi.mock("../../services/questionSourceService", () => ({
  createSource: mocks.createSource,
  newQuestionSourceId: () => "new-source",
}));

import { MAX_SOURCE_PAGES, PAGE_LONG_EDGE_PX, THUMBNAIL_LONG_EDGE_PX } from "../../constants/questionBank";
import type { CreateSourceInput } from "../../services/questionSourceService";
import { hasPageImage, mockStore, resetMockStore } from "../../services/mockStore";
import { logger } from "../../utils/logger";
import { SourceUploadDialog } from "./SourceUploadDialog";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function rendered(size: number): RenderedPage {
  return { blob: new Blob(["jpeg"]), width: size, height: size };
}

/** 每個檔案展開成一頁；檔名就是頁的 key。 */
function pagesOf(files: readonly File[]): { pages: PageInput[]; errors: [] } {
  return {
    pages: files.map((file) => ({ key: file.name, file, kind: "image", rotation: 0 })),
    errors: [],
  };
}

function photos(prefix: string, count: number): File[] {
  return Array.from(
    { length: count },
    (_, index) => new File(["x"], `${prefix}${index + 1}.jpg`, { type: "image/jpeg" }),
  );
}

let container: HTMLDivElement;
let root: Root;
let onClose: ReturnType<typeof vi.fn<() => void>>;
let onUploaded: ReturnType<typeof vi.fn<(sourceId: string) => void>>;
let objectUrls: string[];

beforeAll(() => {
  // jsdom 沒有實作 <dialog> 的 showModal／close。
  Object.defineProperty(HTMLDialogElement.prototype, "open", {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute("open");
    },
  });
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  resetMockStore();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  mocks.expandFilesToPages.mockReset().mockImplementation(async (files: File[]) => pagesOf(files));
  mocks.renderPage.mockReset().mockImplementation(async (_input: PageInput, size: number) => rendered(size));
  mocks.releasePdfFiles.mockClear();
  // 跟真正的 createSource 一樣：一頁存好才要下一頁。
  mocks.createSource.mockReset().mockImplementation(async (input: CreateSourceInput) => {
    for (let index = 0; index < input.pageCount; index += 1) {
      await input.renderPage(index);
      input.onProgress?.(index + 1, input.pageCount);
    }
  });
  objectUrls = [];
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:thumb-${objectUrls.length + 1}`;
    objectUrls.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
  onClose = vi.fn<() => void>();
  onUploaded = vi.fn<(sourceId: string) => void>();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  resetMockStore();
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderDialog() {
  act(() => root.render(<SourceUploadDialog isOpen onClose={onClose} onUploaded={onUploaded} />));
}

function dialog(): HTMLDialogElement {
  const found = container.querySelector("dialog");
  if (!found) throw new Error("dialog not found");
  return found;
}

function fileInput(): HTMLInputElement {
  const found = container.querySelector('input[type="file"]');
  if (!(found instanceof HTMLInputElement)) throw new Error("file input not found");
  return found;
}

function uploadButton(): HTMLButtonElement {
  const found = container.querySelector(".modal-action .btn-primary");
  if (!(found instanceof HTMLButtonElement)) throw new Error("upload button not found");
  return found;
}

function alertText(): string {
  return [...container.querySelectorAll('[role="alert"]')].map((item) => item.textContent).join("\n");
}

function tileCount(): number {
  return container.querySelectorAll("ul.grid > li").length;
}

/** 讓等待中的 promise 與 React 更新跑完。 */
async function settle() {
  await act(async () => {
    for (let round = 0; round < 5; round += 1) await Promise.resolve();
  });
}

async function pick(files: File[]) {
  const input = fileInput();
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

function fillForm() {
  const title = container.querySelector('input:not([type="file"])') as HTMLInputElement;
  const subject = container.querySelector("select") as HTMLSelectElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(title, "四上數學");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(subject, "math");
    subject.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function fullSizeRenders(): number {
  return mocks.renderPage.mock.calls.filter(([, size]) => size === PAGE_LONG_EDGE_PX).length;
}

function preview(page: number): HTMLImageElement {
  const found = container.querySelector(`img[alt="第 ${page} 頁"]`);
  if (!(found instanceof HTMLImageElement)) throw new Error(`preview of page ${page} not found`);
  return found;
}

/** jsdom 沒有 DragEvent／DataTransfer：用可取消的 Event 帶上 dataTransfer。 */
function dragEvent(type: "dragover" | "drop", files: File[], types = ["Files"]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types, files, dropEffect: "copy" } });
  return event;
}

async function drop(files: File[], target: Element = dialog()) {
  const over = dragEvent("dragover", files);
  const dropped = dragEvent("drop", files);
  await act(async () => {
    target.dispatchEvent(over);
    target.dispatchEvent(dropped);
  });
  await settle();
  return { over, dropped };
}

function rotatePage(page: number) {
  const button = container.querySelector(`[aria-label="旋轉第 ${page} 頁"]`) as HTMLButtonElement;
  act(() => button.click());
}

function pastExamsLink(): HTMLAnchorElement | null {
  return [...container.querySelectorAll("a")].find((item) => item.textContent?.includes("從考古題匯入")) ?? null;
}

describe("SourceUploadDialog", () => {
  it("links to 考古題 for importing, but not during an upload", async () => {
    renderDialog();
    expect(pastExamsLink()?.getAttribute("href")).toBe("/past-exams");

    await pick(photos("p", 1));
    fillForm();
    const firstPage = deferred<RenderedPage>();
    mocks.renderPage.mockImplementation((_input: PageInput, size: number) =>
      size === PAGE_LONG_EDGE_PX ? firstPage.promise : Promise.resolve(rendered(size)),
    );
    act(() => uploadButton().click());
    expect(pastExamsLink()).toBeNull();

    firstPage.resolve(rendered(PAGE_LONG_EDGE_PX));
    await settle();
    expect(pastExamsLink()).not.toBeNull();
  });

  it("stops making thumbnails and releases them and the PDFs when it unmounts", async () => {
    const thumbnails = [deferred<RenderedPage>(), deferred<RenderedPage>(), deferred<RenderedPage>()];
    mocks.renderPage.mockImplementation(() => thumbnails[mocks.renderPage.mock.calls.length - 1].promise);
    renderDialog();
    const files = photos("p", 3);
    await pick(files);

    thumbnails[0].resolve(rendered(THUMBNAIL_LONG_EDGE_PX));
    await settle();
    expect(objectUrls).toEqual(["blob:thumb-1"]);

    act(() => root.unmount());
    thumbnails[1].resolve(rendered(THUMBNAIL_LONG_EDGE_PX));
    await settle();
    thumbnails[2].resolve(rendered(THUMBNAIL_LONG_EDGE_PX));
    await settle();

    expect(objectUrls).toEqual(["blob:thumb-1"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:thumb-1");
    expect(mocks.releasePdfFiles).toHaveBeenCalledWith(files);
    expect(mocks.renderPage).toHaveBeenCalledTimes(2);
    // afterEach 還會再 unmount 一次
    root = createRoot(container);
  });

  it.each([1, 2])("rolls back a %i-page upload unmounted during the final render", async (count) => {
    const { createSource, createQuestionSourcePath } = await vi.importActual<typeof import("../../services/questionSourceService")>(
      "../../services/questionSourceService",
    );
    mocks.createSource.mockImplementation(createSource);
    renderDialog();
    await pick(photos("p", count));
    fillForm();
    const finalPage = deferred<RenderedPage>();
    mocks.renderPage.mockImplementation((input: PageInput, size: number) =>
      size === PAGE_LONG_EDGE_PX && input.file.name === `p${count}.jpg`
        ? finalPage.promise
        : Promise.resolve(rendered(size)),
    );

    act(() => uploadButton().click());
    await settle();
    expect(fullSizeRenders()).toBe(count);
    act(() => root.unmount());
    finalPage.resolve(rendered(PAGE_LONG_EDGE_PX));
    await settle();

    expect(mockStore.sources.size).toBe(0);
    for (let index = 0; index < count; index += 1) {
      expect(hasPageImage(createQuestionSourcePath("public", "new-source", index))).toBe(false);
    }
    expect(onUploaded).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("stops an upload and does not report it once the dialog has unmounted", async () => {
    renderDialog();
    await pick(photos("p", 2));
    fillForm();
    const firstPage = deferred<RenderedPage>();
    mocks.renderPage.mockImplementation((_input: PageInput, size: number) =>
      size === PAGE_LONG_EDGE_PX ? firstPage.promise : Promise.resolve(rendered(size)),
    );

    act(() => uploadButton().click());
    expect(uploadButton().textContent).toBe("上傳中 0/2");
    act(() => root.unmount());
    firstPage.resolve(rendered(PAGE_LONG_EDGE_PX));
    await settle();

    // 不再 render 第二頁（PDF 已釋放，再 render 會重新開檔），也不會跳到新來源
    expect(fullSizeRenders()).toBe(1);
    expect(onUploaded).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("keeps 上傳 disabled while another batch of files is still being read", async () => {
    renderDialog();
    await pick(photos("a", 1));
    fillForm();
    expect(uploadButton().disabled).toBe(false);

    const secondBatch = deferred<ReturnType<typeof pagesOf>>();
    mocks.expandFilesToPages.mockImplementationOnce(() => secondBatch.promise);
    const pdf = new File(["%PDF"], "exam.pdf", { type: "application/pdf" });
    await pick([pdf]);
    expect(uploadButton().disabled).toBe(true);

    secondBatch.resolve(pagesOf([pdf]));
    await settle();
    expect(tileCount()).toBe(2);
    expect(uploadButton().disabled).toBe(false);
  });

  it("reopens when the browser closes it during an upload anyway", async () => {
    renderDialog();
    await pick(photos("p", 1));
    fillForm();
    mocks.renderPage.mockImplementation((_input: PageInput, size: number) =>
      size === PAGE_LONG_EDGE_PX ? new Promise(() => {}) : Promise.resolve(rendered(size)),
    );
    act(() => uploadButton().click());

    // 第二次按 Esc（或 Android 返回）時 cancel 不能取消，瀏覽器會直接關掉對話框
    act(() => {
      dialog().dispatchEvent(new Event("cancel", { cancelable: false }));
      dialog().removeAttribute("open");
      dialog().dispatchEvent(new Event("close"));
    });

    expect(dialog().open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(uploadButton().textContent).toBe("上傳中 0/1");
  });

  it("tells the parent when the browser closes it by itself", async () => {
    renderDialog();
    await pick(photos("p", 1));

    act(() => {
      dialog().removeAttribute("open");
      dialog().dispatchEvent(new Event("close"));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tileCount()).toBe(0);
  });

  it("lets keyboard users reach the file picker", () => {
    renderDialog();
    // display:none（Tailwind 的 hidden）會讓 input 無法用 Tab 聚焦
    expect(fileInput().classList.contains("hidden")).toBe(false);
    expect(fileInput().classList.contains("sr-only")).toBe(true);
  });

  it("adds files dropped on it like the file picker does", async () => {
    renderDialog();
    const files = photos("d", 2);
    const heading = container.querySelector("h3") ?? dialog();
    const { over, dropped } = await drop(files, heading);

    // 不取消的話瀏覽器會直接在分頁裡打開檔案，記憶體裡的資料就全沒了
    expect(over.defaultPrevented).toBe(true);
    expect(dropped.defaultPrevented).toBe(true);
    expect(mocks.expandFilesToPages).toHaveBeenCalledWith(files);
    expect(tileCount()).toBe(2);
  });

  it("ignores files dropped while another batch is still being read", async () => {
    renderDialog();
    const firstBatch = deferred<ReturnType<typeof pagesOf>>();
    mocks.expandFilesToPages.mockImplementationOnce(() => firstBatch.promise);
    const first = photos("a", 1);
    await pick(first);

    const { dropped } = await drop(photos("b", 1));
    expect(dropped.defaultPrevented).toBe(true);
    expect(mocks.expandFilesToPages).toHaveBeenCalledTimes(1);

    firstBatch.resolve(pagesOf(first));
    await settle();
    expect(tileCount()).toBe(1);
  });

  it("ignores files dropped during an upload", async () => {
    renderDialog();
    await pick(photos("p", 1));
    fillForm();
    const firstPage = deferred<RenderedPage>();
    mocks.renderPage.mockImplementation((_input: PageInput, size: number) =>
      size === PAGE_LONG_EDGE_PX ? firstPage.promise : Promise.resolve(rendered(size)),
    );
    act(() => uploadButton().click());

    const { dropped } = await drop(photos("late", 1));
    expect(dropped.defaultPrevented).toBe(true);
    expect(mocks.expandFilesToPages).toHaveBeenCalledTimes(1);

    firstPage.resolve(rendered(PAGE_LONG_EDGE_PX));
    await settle();
  });

  it("leaves drags without files to the browser", async () => {
    renderDialog();
    const over = dragEvent("dragover", [], ["text/plain"]);
    const dropped = dragEvent("drop", [], ["text/plain"]);
    await act(async () => {
      dialog().dispatchEvent(over);
      dialog().dispatchEvent(dropped);
    });

    expect(over.defaultPrevented).toBe(false);
    expect(dropped.defaultPrevented).toBe(false);
    expect(mocks.expandFilesToPages).not.toHaveBeenCalled();
  });

  it("does not count pages that failed to load against the page limit", async () => {
    renderDialog();
    mocks.renderPage.mockImplementation(async (input: PageInput, size: number) => {
      if (input.key.startsWith("bad")) throw new Error("decode failed");
      return rendered(size);
    });
    await pick([...photos("good", MAX_SOURCE_PAGES - 7), ...photos("bad", 5)]);
    expect(tileCount()).toBe(MAX_SOURCE_PAGES - 2);

    await pick(photos("more", 5));

    expect(alertText()).not.toContain("總頁數超過");
    expect(tileCount()).toBe(MAX_SOURCE_PAGES + 3);
  });

  it("checks the page limit against pages deleted while files were being read", async () => {
    renderDialog();
    await pick(photos("p", MAX_SOURCE_PAGES - 2));
    const secondBatch = deferred<ReturnType<typeof pagesOf>>();
    mocks.expandFilesToPages.mockImplementationOnce(() => secondBatch.promise);
    await pick(photos("more", 5));

    for (const page of [1, 2, 3]) {
      const remove = container.querySelector(`[aria-label="刪除第 ${page} 頁"]`) as HTMLButtonElement;
      act(() => remove.click());
    }
    expect(tileCount()).toBe(MAX_SOURCE_PAGES - 5);
    secondBatch.resolve(pagesOf(photos("more", 5)));
    await settle();

    expect(alertText()).not.toContain("總頁數超過");
    expect(tileCount()).toBe(MAX_SOURCE_PAGES);
  });

  it("says which page failed instead of blaming the network", async () => {
    renderDialog();
    await pick(photos("p", 3));
    fillForm();
    mocks.renderPage.mockImplementation(async (input: PageInput, size: number) => {
      if (size === PAGE_LONG_EDGE_PX && input.key === "p2.jpg") {
        throw new Error("canvas.toBlob returned null");
      }
      return rendered(size);
    });

    act(() => uploadButton().click());
    await settle();

    expect(alertText()).toContain("第 2 頁");
    expect(alertText()).not.toContain("網路");
    expect(logger.error).toHaveBeenCalled();
    expect(uploadButton().textContent).toBe("重試");
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("keeps turning a page clockwise when it comes back upright", async () => {
    renderDialog();
    await pick(photos("p", 1));
    fillForm();

    const angles: string[] = [];
    for (let turn = 0; turn < 5; turn += 1) {
      rotatePage(1);
      angles.push(preview(1).style.transform);
    }
    act(() => uploadButton().click());
    await settle();

    // 270° 之後若回到 rotate(0deg)，CSS 轉場會倒轉一大圈
    expect(angles).toEqual([
      "rotate(90deg)",
      "rotate(180deg)",
      "rotate(270deg)",
      "rotate(360deg)",
      "rotate(450deg)",
    ]);
    const [input, size] = mocks.renderPage.mock.calls.at(-1) as [PageInput, number];
    expect(size).toBe(PAGE_LONG_EDGE_PX);
    expect(input.rotation).toBe(90);
  });

  it("shrinks a sideways preview to fit its box instead of cutting off both ends", async () => {
    renderDialog();
    await pick(photos("p", 1));
    const upright = ["max-h-full", "max-w-full"];
    // transform 不改變排版大小：轉 90° 時要先把圖縮進橫放的框（寬＝框高、高＝框寬），轉完才放得進 3:4 的框
    const sideways = ["max-h-[75%]", "max-w-[calc(100%*4/3)]"];
    const classes = () => [...preview(1).classList];

    expect(classes()).toEqual(expect.arrayContaining(upright));

    rotatePage(1);
    expect(classes()).toEqual(expect.arrayContaining(sideways));
    expect(classes()).not.toEqual(expect.arrayContaining(["max-h-full"]));

    rotatePage(1);
    expect(classes()).toEqual(expect.arrayContaining(upright));

    rotatePage(1);
    expect(classes()).toEqual(expect.arrayContaining(sideways));
  });
});
