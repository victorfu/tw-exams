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
      // 離開這個網址／這次嘗試時清掉結果，避免切回來時先閃出舊的（可能已被 destroy 的）文件。
      setResult(null);
    };
  }, [url, attempt]);

  // 換考卷時捲回頂端。
  useEffect(() => {
    scroller?.scrollTo?.({ top: 0, left: 0 });
  }, [url, scroller]);

  // 內容區寬度（不含 padding）：第一次回報立刻套用，之後才在拖拉視窗時等一下再重畫。
  useEffect(() => {
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (first) {
        first = false;
        setContainerWidth(width);
        return;
      }
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
      <div
        ref={setScroller}
        role="document"
        aria-label={title}
        className="h-full overflow-auto p-3 [scrollbar-gutter:stable]"
      >
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
              <a href={url} target="_blank" rel="noopener" className="btn btn-primary btn-sm">
                <ExternalLink className="size-4" aria-hidden="true" />
                在新分頁開啟
              </a>
            </div>
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-3 pb-16">
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
  const lastRenderedWidthRef = useRef<number | null>(null);
  const [intersecting, setIntersecting] = useState(false);
  const hasWidth = display.width > 0;

  // 寬度確定後才開始觀察是否進出畫面（前後一個畫面高）；離開畫面仍持續觀察，回來時可能要重畫。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasWidth) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // 一次 callback 可能夾帶好幾筆（例如快速滑動時先離開又進入）；最新狀態看最後一筆。
        setIntersecting(entries[entries.length - 1]?.isIntersecting ?? false);
      },
      { root, rootMargin: "100% 0px" },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [root, hasWidth]);

  // 進入畫面、且寬度（縮放）跟上次畫的不一樣時才重畫；離開畫面保留舊畫面，不清除。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !intersecting || display.width === 0) return;
    if (lastRenderedWidthRef.current === display.width) return;
    // 開始畫之前先清掉：pdf.js 會在 render() 裡先把 canvas resize（連帶清空畫面），
    // 如果這次被取消，不能讓 ref 停留在舊寬度，害之後切回舊寬度時誤判成「畫過了」而跳過重畫。
    lastRenderedWidthRef.current = null;
    const pixelRatio = renderPixelRatio(window.devicePixelRatio, { width: display.width, height: display.height });
    const handle = pdf.renderPage(pageNumber, canvas, display.width, pixelRatio);
    handle.promise.then(
      () => {
        lastRenderedWidthRef.current = display.width;
      },
      (error: unknown) => {
        if (!(error instanceof Error && error.name === "RenderingCancelledException")) {
          logger.warn("[PdfViewer] render failed", error);
        }
      },
    );
    return () => handle.cancel();
  }, [pdf, pageNumber, intersecting, display.width, display.height]);

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
