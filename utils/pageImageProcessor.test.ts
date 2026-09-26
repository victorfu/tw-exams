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
  renderPage,
  rotatedSize,
  UNREADABLE_FILE_MESSAGE,
  type PageInput,
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

interface PhotoSize {
  width: number;
  height: number;
}

/** Safari 16.4–17.1 的 ImageOrientation 還沒有 "from-image"（WebKit 7617 才加）。 */
const SAFARI_16_ORIENTATIONS = ["none", "flipY"];

/**
 * 模仿瀏覽器：照片的尺寸都是依 EXIF 轉正後的（<img> 的 naturalWidth 跟 createImageBitmap 一樣）。
 * jsdom 不會解碼圖片，也沒有 createImageBitmap 和 canvas。
 */
function stubPhotoDecoding(
  natural: PhotoSize,
  { orientations = ["from-image", "none", "flipY"], loads = true, rawAxes = false } = {},
) {
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(natural.width);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(natural.height);
  vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (this: HTMLImageElement) {
    setTimeout(() => this.dispatchEvent(new Event(loads ? "load" : "error")));
  });
  const createImageBitmap = vi.fn(async (_source: ImageBitmapSource, options: ImageBitmapOptions = {}) => {
    // 跟 WebIDL 一樣：字典裡不認得的列舉值會丟 TypeError
    if (options.imageOrientation !== undefined && !orientations.includes(options.imageOrientation)) {
      throw new TypeError(
        `The provided value '${options.imageOrientation}' is not a valid enum value of type ImageOrientation.`,
      );
    }
    const width = options.resizeWidth ?? natural.width;
    const height = options.resizeHeight ?? natural.height;
    // rawAxes：Chromium 131 以前把 resize 套在 EXIF 轉正前的像素軸上，回報的寬高也是那個方向
    return rawAxes ? { width: height, height: width, close: vi.fn() } : { width, height, close: vi.fn() };
  });
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  const context = { fillStyle: "", fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
    callback(new Blob(["jpeg"], { type: "image/jpeg" })),
  );
  return { createImageBitmap, context };
}

function photoPage(rotation: PageInput["rotation"] = 0): PageInput {
  return { key: "photo", file: fileOf("photo.jpg", "image/jpeg"), kind: "image", rotation };
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

describe("renderPage for photos", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:photo");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("works on Safari 16.4–17.1, whose createImageBitmap does not know 'from-image'", async () => {
    stubPhotoDecoding({ width: 4032, height: 3024 }, { orientations: SAFARI_16_ORIENTATIONS });

    await expect(renderPage(photoPage(), 240)).resolves.toMatchObject({ width: 240, height: 180 });
  });

  it("decodes a photo straight at the output size instead of at full resolution", async () => {
    const { createImageBitmap } = stubPhotoDecoding({ width: 5712, height: 4284 });
    const page = photoPage();

    expect(await renderPage(page, 240)).toMatchObject({ width: 240, height: 180 });
    expect(await renderPage(page, 2400)).toMatchObject({ width: 2400, height: 1800 });

    expect(createImageBitmap.mock.calls).toEqual([
      [page.file, { resizeWidth: 240, resizeHeight: 180, resizeQuality: "high" }],
      [page.file, { resizeWidth: 2400, resizeHeight: 1800, resizeQuality: "high" }],
    ]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("turns the upright photo by the user's rotation", async () => {
    // 直拍的 iPhone 照片：像素是橫的，EXIF 說要轉 90°；瀏覽器回報的是轉正後的直式尺寸
    const { createImageBitmap, context } = stubPhotoDecoding({ width: 4284, height: 5712 });

    const result = await renderPage(photoPage(90), 2400);

    expect(createImageBitmap).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ resizeWidth: 1800, resizeHeight: 2400 }),
    );
    expect(result).toMatchObject({ width: 2400, height: 1800 });
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), -900, -1200, 1800, 2400);
  });

  it("resizes along the raw pixel axes on Chromium before 132", async () => {
    // 直拍照片（EXIF 90°）：舊版 Chromium 會把 1800×2400 套到橫的原始像素上，縱向只剩 75% 的取樣
    const { createImageBitmap, context } = stubPhotoDecoding({ width: 4284, height: 5712 }, { rawAxes: true });

    await renderPage(photoPage(), 2400);

    expect(createImageBitmap.mock.calls.map(([, options]) => [options?.resizeWidth, options?.resizeHeight])).toEqual([
      [1800, 2400],
      [2400, 1800],
    ]);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), -900, -1200, 1800, 2400);
  });

  it("never enlarges a small photo", async () => {
    const { createImageBitmap } = stubPhotoDecoding({ width: 800, height: 600 });

    expect(await renderPage(photoPage(), 2400)).toMatchObject({ width: 800, height: 600 });
    expect(createImageBitmap).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ resizeWidth: 800, resizeHeight: 600 }),
    );
  });

  it("fails without decoding when the browser cannot read the photo", async () => {
    const { createImageBitmap } = stubPhotoDecoding({ width: 0, height: 0 }, { loads: false });

    await expect(renderPage(photoPage(), 240)).rejects.toThrow();
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });
});
