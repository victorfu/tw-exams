import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Size } from "./pdfLayout";

export interface RenderHandle {
  promise: Promise<void>;
  cancel(): void;
}

export interface LoadedPdf {
  /** 每頁原始尺寸（scale 1），順序同頁碼。 */
  pageSizes: Size[];
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number, pixelRatio: number): RenderHandle;
  destroy(): void;
}

/** 下載失敗；status 是 HTTP 狀態碼，網路錯誤時是 null。 */
export class PdfLoadError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "PdfLoadError";
    this.status = status;
  }
}

/** 自己用 fetch 抓整個檔案（可中斷），再交給 pdf.js；pdf.js 只在瀏覽器用到時才載入。 */
export async function loadPdfDocument(url: string, signal: AbortSignal): Promise<LoadedPdf> {
  let response: Response;
  try {
    response = await fetch(url, { signal, credentials: "same-origin" });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new PdfLoadError("無法下載 PDF", null);
  }
  if (!response.ok) throw new PdfLoadError(`下載 PDF 失敗（HTTP ${response.status}）`, response.status);
  const data = new Uint8Array(await response.arrayBuffer());

  const { pdfjs, pdfDocumentOptions } = await import("../../utils/pdfConfig");
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data, ...pdfDocumentOptions }).promise;
  if (signal.aborted) {
    void pdf.destroy();
    throw new DOMException("Aborted", "AbortError");
  }

  const pageSizes: Size[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const { width, height } = (await pdf.getPage(pageNumber)).getViewport({ scale: 1 });
    pageSizes.push({ width, height });
  }

  return {
    pageSizes,
    renderPage(pageNumber, canvas, cssWidth, pixelRatio) {
      let task: RenderTask | null = null;
      let cancelled = false;
      const promise = (async () => {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (cssWidth * pixelRatio) / base.width });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        task = page.render({ canvas, viewport, background: "rgb(255,255,255)" });
        await task.promise;
      })();
      return {
        promise,
        cancel() {
          cancelled = true;
          task?.cancel();
        },
      };
    },
    destroy() {
      void pdf.destroy();
    },
  };
}
