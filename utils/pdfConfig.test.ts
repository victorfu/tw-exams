// @vitest-environment node
// 載入真正的 pdfjs-dist：jsdom 沒有 pdf.js 要的 API，Node 下 pdf.js 會自己補。
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PDFJS_ROOT = fileURLToPath(new URL("../node_modules/pdfjs-dist/", import.meta.url));

/** 把 unpkg 上的網址對應到 node_modules 裡同一個檔案。 */
function localPath(url: string, version: string): string {
  const base = `https://unpkg.com/pdfjs-dist@${version}/`;
  expect(url.startsWith(base), url).toBe(true);
  return `${PDFJS_ROOT}${url.slice(base.length)}`;
}

/** 最小的一頁 PDF；沒有 xref，pdf.js 會自己重建。 */
const ONE_PAGE_PDF = new TextEncoder().encode(
  [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >> endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
  ].join("\n"),
);

// 模擬 Safari 17.4 以前沒有 Promise.withResolvers 的瀏覽器。pdfjs-dist 由 Node 直接載入、
// 整個檔案只執行一次，所以要在任何測試載入 pdfConfig 之前拿掉。
const nativeWithResolvers = Promise.withResolvers;
beforeAll(() => {
  Reflect.deleteProperty(Promise, "withResolvers");
});
afterAll(() => {
  Promise.withResolvers = nativeWithResolvers;
});

describe("pdfConfig", () => {
  it("opens PDFs on browsers without Promise.withResolvers (Safari before 17.4)", async () => {
    const { pdfjs } = await import("./pdfConfig");
    // 用設定裡的同一支 worker，但在同一個執行緒跑，測試不必連 unpkg。
    const workerPath = localPath(pdfjs.GlobalWorkerOptions.workerSrc, pdfjs.version);
    (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = await import(
      /* @vite-ignore */ pathToFileURL(workerPath).href
    );
    const pdf = await pdfjs.getDocument({ data: ONE_PAGE_PDF.slice() }).promise;
    expect(pdf.numPages).toBe(1);
    await pdf.destroy();
  });

  it("loads the worker, cMaps, fonts and wasm decoders from folders pdfjs-dist ships", async () => {
    const { pdfjs, pdfDocumentOptions } = await import("./pdfConfig");
    const installed = JSON.parse(readFileSync(`${PDFJS_ROOT}package.json`, "utf8")) as { version: string };
    expect(pdfjs.version).toBe(installed.version);

    const base = `https://unpkg.com/pdfjs-dist@${installed.version}/`;
    const assetUrls = {
      workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
      cMapUrl: pdfDocumentOptions.cMapUrl,
      standardFontDataUrl: pdfDocumentOptions.standardFontDataUrl,
      // 沒有 wasmUrl，JPEG 2000（JPXDecode）的掃描頁會畫成一片白
      wasmUrl: pdfDocumentOptions.wasmUrl,
      iccUrl: pdfDocumentOptions.iccUrl,
    };
    for (const [name, url] of Object.entries(assetUrls)) {
      expect(url, name).toEqual(expect.any(String));
      expect(existsSync(localPath(url, installed.version)), `${name}: ${url}`).toBe(true);
    }
    expect(existsSync(`${localPath(assetUrls.wasmUrl, installed.version)}openjpeg.wasm`)).toBe(true);
    // worker 要跟主程式同一套 legacy build
    expect(assetUrls.workerSrc).toBe(`${base}legacy/build/pdf.worker.min.mjs`);
  });
});
