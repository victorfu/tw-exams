import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getDocument = vi.fn();
  return {
    getDocument,
    // 真正的 pdfjs 在 jsdom 載入會失敗；pdfConfig 載入時會設定 worker。
    pdfConfig: () => ({ pdfjs: { getDocument }, pdfDocumentOptions: {} }),
  };
});

vi.mock("./pdfConfig", mocks.pdfConfig);

import { logger } from "./logger";
import {
  expandFilesToPages,
  fitLongEdge,
  nextRotation,
  PDF_ENGINE_FAILED_MESSAGE,
  releasePdfFiles,
  rotatedSize,
  UNREADABLE_FILE_MESSAGE,
} from "./pageImageProcessor";

function fileOf(name: string, type: string, size?: number): File {
  const file = new File(["data"], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new ArrayBuffer(4),
  });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
}

/** 模仿 pdfjs 的 PDFDocumentLoadingTask；在 getDocument 被呼叫時才建立。 */
function loadingTask(promise: Promise<unknown>, destroy = vi.fn(async () => {})) {
  return { promise, destroy };
}

/** pdf.js 讀到有密碼的 PDF 時丟的錯誤（pdfjs-dist 沒有匯出這個類別）。 */
function passwordException(): Error {
  const error = new Error("No password given");
  error.name = "PasswordException";
  return error;
}

describe("fitLongEdge", () => {
  it("scales the long edge down to the limit", () => {
    expect(fitLongEdge(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitLongEdge(3000, 6000, 2400)).toEqual({ width: 1200, height: 2400 });
  });

  it("never scales up", () => {
    expect(fitLongEdge(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });
});

describe("rotatedSize", () => {
  it("swaps width and height for quarter turns", () => {
    expect(rotatedSize(100, 200, 90)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 270)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 180)).toEqual({ width: 100, height: 200 });
    expect(rotatedSize(100, 200, 0)).toEqual({ width: 100, height: 200 });
  });
});

describe("nextRotation", () => {
  it("cycles clockwise", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("expandFilesToPages", () => {
  beforeEach(() => {
    mocks.getDocument.mockReset();
    vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("turns each photo into one upright page", async () => {
    const { pages, errors } = await expandFilesToPages([
      fileOf("a.jpg", "image/jpeg"),
      fileOf("b.png", "image/png"),
    ]);
    expect(errors).toEqual([]);
    expect(pages.map((page) => [page.file.name, page.kind, page.rotation])).toEqual([
      ["a.jpg", "image", 0],
      ["b.png", "image", 0],
    ]);
    expect(new Set(pages.map((page) => page.key)).size).toBe(2);
  });

  it("expands a PDF into one page per PDF page", async () => {
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.resolve({ numPages: 3 }) }));
    const { pages } = await expandFilesToPages([fileOf("exam.pdf", "application/pdf")]);
    expect(pages.map((page) => [page.kind, page.pdfPageNumber])).toEqual([
      ["pdf", 1],
      ["pdf", 2],
      ["pdf", 3],
    ]);
  });

  it("reports unreadable and oversized files without dropping the others", async () => {
    // 呼叫時才建立 rejected promise，避免在被 await 之前觸發 unhandled rejection
    mocks.getDocument.mockImplementation(() => loadingTask(Promise.reject(new Error("password"))));
    const { pages, errors } = await expandFilesToPages([
      fileOf("notes.txt", "text/plain"),
      fileOf("big.jpg", "image/jpeg", 60 * 1024 * 1024),
      fileOf("locked.pdf", "application/pdf"),
      fileOf("ok.webp", "image/webp"),
    ]);
    expect(pages.map((page) => page.file.name)).toEqual(["ok.webp"]);
    expect(errors).toEqual([
      { fileName: "notes.txt", message: UNREADABLE_FILE_MESSAGE },
      { fileName: "big.jpg", message: "檔案超過 50MB，請拆開上傳" },
      { fileName: "locked.pdf", message: UNREADABLE_FILE_MESSAGE },
    ]);
  });

  it("shuts down pdf.js for a PDF it could not open, and logs why", async () => {
    const error = passwordException();
    const destroy = vi.fn(async () => {});
    mocks.getDocument.mockImplementation(() => loadingTask(Promise.reject(error), destroy));
    const locked = fileOf("locked.pdf", "application/pdf");

    const { errors } = await expandFilesToPages([locked]);

    expect(errors).toEqual([{ fileName: "locked.pdf", message: UNREADABLE_FILE_MESSAGE }]);
    // 開檔失敗時 pdf.js 不會自己關 worker；不 destroy 的話 worker 和整份檔案會一直留著
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), "locked.pdf", error);
    await expect(releasePdfFiles([locked])).resolves.toBeUndefined();
  });

  it("tries a failed PDF again instead of keeping the failure cached", async () => {
    mocks.getDocument
      .mockImplementationOnce(() => loadingTask(Promise.reject(new Error("network"))))
      .mockImplementationOnce(() => loadingTask(Promise.resolve({ numPages: 2, destroy: vi.fn() })));
    const exam = fileOf("exam.pdf", "application/pdf");

    expect((await expandFilesToPages([exam])).errors).toHaveLength(1);
    const retry = await expandFilesToPages([exam]);

    expect(retry.errors).toEqual([]);
    expect(retry.pages).toHaveLength(2);
    expect(mocks.getDocument).toHaveBeenCalledTimes(2);
  });

  it("does not blame the file when the PDF reader itself fails to load", async () => {
    const chunkError = new Error("Loading chunk 123 failed.");
    vi.resetModules();
    vi.doMock("./pdfConfig", () => {
      throw chunkError;
    });
    try {
      const freshLogger = (await import("./logger")).logger;
      const warn = vi.spyOn(freshLogger, "warn").mockImplementation(() => {});
      const fresh = await import("./pageImageProcessor");
      const { pages, errors } = await fresh.expandFilesToPages([fileOf("exam.pdf", "application/pdf")]);

      expect(pages).toEqual([]);
      expect(errors).toEqual([{ fileName: "exam.pdf", message: PDF_ENGINE_FAILED_MESSAGE }]);
      expect(PDF_ENGINE_FAILED_MESSAGE).not.toBe(UNREADABLE_FILE_MESSAGE);
      expect(warn).toHaveBeenCalledWith(
        expect.any(String),
        "exam.pdf",
        expect.objectContaining({ name: "PdfEngineLoadError" }),
      );
    } finally {
      vi.doMock("./pdfConfig", mocks.pdfConfig);
      vi.resetModules();
    }
  });
});
