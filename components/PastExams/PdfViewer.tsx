"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, RotateCw } from "lucide-react";
import { logger } from "../../utils/logger";
import { loadPdfDocument, PdfLoadError, type LoadedPdf } from "./pdfDocument";
import { MAX_ZOOM, MIN_ZOOM, pageDisplaySize, renderPixelRatio, stepZoom, zoomLabel, type Size } from "./pdfLayout";

const RESIZE_DEBOUNCE_MS = 150;

type LoadResult = { url: string; attempt: number } & (
  | { pdf: LoadedPdf; error: null }
  | { pdf: null; error: string }
);

/** 把下載或解析錯誤轉成給使用者看的訊息。 */
export function pdfErrorMessage(error: unknown): string {
  if (error instanceof PdfLoadError && error.status === 404) return "找不到這份考卷的檔案（可能還沒上傳）";
  if (error instanceof PdfLoadError && error.status === 403) return "請從考古題頁面開啟這份考卷";
  return "PDF 載入失敗";
}

/**
 * 用 pdf.js 把考卷畫在 canvas 上：所有頁由上而下，快捲進畫面才畫，可縮放。
 * 換網址時中斷上一份的下載並釋放文件；縮放倍率跨考卷保留。
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let pdf: LoadedPdf | null = null;
    loadPdfDocument(url, controller.signal).then(
      (loaded) => {
        if (controller.signal.aborted) {
          loaded.destroy();
          return;
        }
        pdf = loaded;
        setResult({ url, attempt, pdf: loaded, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        logger.warn("[PdfViewer] load failed", error);
        setResult({ url, attempt, pdf: null, error: pdfErrorMessage(error) });
      },
    );
    return () => {
      controller.abort();
      pdf?.destroy();
    };
  }, [url, attempt]);

  // 換考卷時捲回頂端。
  useEffect(() => {
    scroller?.scrollTo?.({ top: 0, left: 0 });
  }, [url, scroller]);

  // 內容區寬度（不含 padding）；拖拉視窗時等一下才重畫。
  useEffect(() => {
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      clearTimeout(timer);
      timer = setTimeout(() => setContainerWidth(width), RESIZE_DEBOUNCE_MS);
    });
    observer.observe(scroller);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [scroller]);

  const current = result && result.url === url && result.attempt === attempt ? result : null;

  return (
    <div className="relative h-full">
      <div ref={setScroller} role="document" aria-label={title} className="h-full overflow-auto p-3">
        {current === null ? (
          <div className="flex h-full items-center justify-center">
            <span className="loading loading-spinner loading-lg" aria-label="載入 PDF" />
          </div>
        ) : current.error !== null ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-base-content/70">{current.error}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-sm" onClick={() => setAttempt((value) => value + 1)}>
                <RotateCw className="size-4" aria-hidden="true" />
                重試
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                <ExternalLink className="size-4" aria-hidden="true" />
                在新分頁開啟
              </a>
            </div>
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-3">
            {current.pdf.pageSizes.map((size, index) => (
              <PdfPage
                key={index}
                pdf={current.pdf}
                pageNumber={index + 1}
                root={scroller}
                display={pageDisplaySize(size, containerWidth, zoom)}
              />
            ))}
          </div>
        )}
      </div>
      {current?.pdf && (
        <div className="join absolute right-3 bottom-3 shadow-md">
          <button
            type="button"
            className="btn join-item btn-sm"
            aria-label="縮小"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => stepZoom(value, -1))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn join-item btn-sm min-w-16"
            title="適合寬度"
            aria-label={`適合寬度（目前 ${zoomLabel(zoom)}）`}
            onClick={() => setZoom(1)}
          >
            {zoomLabel(zoom)}
          </button>
          <button
            type="button"
            className="btn join-item btn-sm"
            aria-label="放大"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => stepZoom(value, 1))}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

interface PdfPageProps {
  pdf: LoadedPdf;
  pageNumber: number;
  display: Size;
  root: Element | null;
}

function PdfPage({ pdf, pageNumber, display, root }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  // 快捲進畫面（前後一個畫面高）才畫；畫過就一直保留。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { root, rootMargin: "100% 0px" },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [root, visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || display.width === 0) return;
    const handle = pdf.renderPage(pageNumber, canvas, display.width, renderPixelRatio(window.devicePixelRatio));
    handle.promise.catch((error: unknown) => {
      if (!(error instanceof Error && error.name === "RenderingCancelledException")) {
        logger.warn("[PdfViewer] render failed", error);
      }
    });
    return () => handle.cancel();
  }, [pdf, pageNumber, visible, display.width]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`第 ${pageNumber} 頁`}
      className="block bg-white shadow-sm"
      style={{ width: display.width, height: display.height }}
    />
  );
}
