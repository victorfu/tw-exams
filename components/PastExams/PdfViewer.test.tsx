import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installObserverStubs, resizeObservedElements, setIntersecting } from "../../testing/observers";
import type { LoadedPdf } from "./pdfDocument";

const mocks = vi.hoisted(() => ({
  loads: [] as {
    url: string;
    signal: AbortSignal;
    resolve: (pdf: LoadedPdf) => void;
    reject: (error: unknown) => void;
  }[],
}));

vi.mock("./pdfDocument", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./pdfDocument")>()),
  loadPdfDocument: (url: string, signal: AbortSignal) =>
    new Promise<LoadedPdf>((resolve, reject) => {
      mocks.loads.push({ url, signal, resolve, reject });
    }),
}));

import { PdfLoadError } from "./pdfDocument";
import { PdfViewer } from "./PdfViewer";

let container: HTMLDivElement;
let root: Root;

function fakePdf(pages: number) {
  return {
    pageSizes: Array.from({ length: pages }, () => ({ width: 600, height: 800 })),
    renderPage: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    destroy: vi.fn(),
  } satisfies LoadedPdf;
}

function render(url: string) {
  act(() => root.render(<PdfViewer url={url} title="考卷" />));
}

async function resolveLoad(index: number, pdf: LoadedPdf) {
  await act(async () => {
    mocks.loads[index].resolve(pdf);
  });
}

async function rejectLoad(index: number, error: unknown) {
  await act(async () => {
    mocks.loads[index].reject(error);
  });
}

function setWidth(width: number) {
  act(() => {
    resizeObservedElements(width);
    vi.advanceTimersByTime(150);
  });
}

function canvases(): HTMLCanvasElement[] {
  return [...container.querySelectorAll("canvas")];
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent?.trim() === name,
  );
  if (!found) throw new Error(`button not found: ${name}`);
  return found;
}

function fitButton(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('[title="適合寬度"]')!;
}

beforeEach(() => {
  vi.useFakeTimers();
  installObserverStubs();
  mocks.loads.length = 0;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PdfViewer", () => {
  it("shows a spinner, then renders every page at the container width", async () => {
    render("/exams/a.pdf");
    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
    expect(mocks.loads[0].url).toBe("/exams/a.pdf");

    const pdf = fakePdf(2);
    await resolveLoad(0, pdf);
    setWidth(600);

    expect(canvases().map((canvas) => canvas.getAttribute("aria-label"))).toEqual(["第 1 頁", "第 2 頁"]);
    expect(canvases()[0].style.width).toBe("600px");
    expect(canvases()[0].style.height).toBe("800px");
    expect(pdf.renderPage).toHaveBeenCalledWith(1, canvases()[0], 600, 1);
    expect(pdf.renderPage).toHaveBeenCalledWith(2, canvases()[1], 600, 1);
  });

  it("does not render while the viewer has no width", async () => {
    render("/exams/a.pdf");
    const pdf = fakePdf(2);
    await resolveLoad(0, pdf);

    expect(canvases()).toHaveLength(2);
    expect(pdf.renderPage).not.toHaveBeenCalled();
  });

  it.each([
    [new PdfLoadError("x", 404), "找不到這份考卷的檔案（可能還沒上傳）"],
    [new PdfLoadError("x", 403), "請從考古題頁面開啟這份考卷"],
    [new PdfLoadError("x", null), "PDF 載入失敗"],
    [new Error("bad pdf"), "PDF 載入失敗"],
  ])("explains a failed load (%s) and offers retry and a new tab", async (error, message) => {
    render("/exams/a.pdf");
    await rejectLoad(0, error);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(message);
    const open = [...container.querySelectorAll("a")].find((link) => link.textContent?.trim() === "在新分頁開啟");
    expect(open?.getAttribute("href")).toBe("/exams/a.pdf");

    act(() => button("重試").click());
    expect(mocks.loads).toHaveLength(2);
    expect(mocks.loads[1].url).toBe("/exams/a.pdf");
    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
  });

  it("drops a slow download when the exam changes", async () => {
    render("/exams/a.pdf");
    render("/exams/b.pdf");
    expect(mocks.loads[0].signal.aborted).toBe(true);

    const b = fakePdf(3);
    await resolveLoad(1, b);
    const a = fakePdf(1);
    await resolveLoad(0, a);

    expect(a.destroy).toHaveBeenCalled();
    expect(canvases()).toHaveLength(3);
  });

  it("releases the previous document when the exam changes", async () => {
    render("/exams/a.pdf");
    const a = fakePdf(2);
    await resolveLoad(0, a);

    render("/exams/b.pdf");

    expect(a.destroy).toHaveBeenCalled();
    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
  });

  it("zooms in steps and back to fit width", async () => {
    render("/exams/a.pdf");
    const pdf = fakePdf(1);
    await resolveLoad(0, pdf);
    setWidth(600);

    act(() => button("放大").click());
    expect(fitButton().textContent).toBe("125%");
    expect(canvases()[0].style.width).toBe("750px");
    expect(pdf.renderPage).toHaveBeenLastCalledWith(1, canvases()[0], 750, 1);

    act(() => fitButton().click());
    expect(canvases()[0].style.width).toBe("600px");

    act(() => button("縮小").click());
    act(() => button("縮小").click());
    expect(fitButton().textContent).toBe("50%");
    expect(button("縮小").disabled).toBe(true);
  });

  it("shows the spinner instead of a stale, destroyed document when navigating back to a still-loading exam", async () => {
    render("/exams/a.pdf");
    const a = fakePdf(1);
    await resolveLoad(0, a);
    setWidth(600);
    const callsAfterFirstRender = a.renderPage.mock.calls.length;

    render("/exams/b.pdf");
    render("/exams/a.pdf");

    expect(container.querySelector('[aria-label="載入 PDF"]')).not.toBeNull();
    expect(a.renderPage).toHaveBeenCalledTimes(callsAfterFirstRender);
  });

  it("redraws only the pages currently in view when zooming", async () => {
    render("/exams/a.pdf");
    const pdf = fakePdf(2);
    await resolveLoad(0, pdf);
    setWidth(600);

    expect(pdf.renderPage).toHaveBeenCalledWith(1, canvases()[0], 600, 1);
    expect(pdf.renderPage).toHaveBeenCalledWith(2, canvases()[1], 600, 1);

    act(() => setIntersecting(canvases()[1], false));
    act(() => button("放大").click());

    expect(pdf.renderPage).toHaveBeenCalledWith(1, canvases()[0], 750, 1);
    expect(pdf.renderPage).not.toHaveBeenCalledWith(2, canvases()[1], 750, 1);

    act(() => setIntersecting(canvases()[1], true));

    expect(pdf.renderPage).toHaveBeenCalledWith(2, canvases()[1], 750, 1);
  });

  it("does not observe or render pages before the container width is known", async () => {
    render("/exams/a.pdf");
    const pdf = fakePdf(1);
    await resolveLoad(0, pdf);

    expect(canvases()).toHaveLength(1);
    expect(pdf.renderPage).not.toHaveBeenCalled();

    setWidth(600);

    expect(pdf.renderPage).toHaveBeenCalledWith(1, canvases()[0], 600, 1);
  });
});
