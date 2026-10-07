import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flush: vi.fn(async () => true),
  imports: [] as {
    examId: string;
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
    resolve: (sourceId: string) => void;
    reject: (error: unknown) => void;
  }[],
}));

vi.mock("./PdfViewer", () => ({
  PdfViewer: ({ url, title }: { url: string; title: string }) => <div data-pdf-viewer={url} aria-label={title} />,
}));
// 真正的匯入要下載、pdf.js、canvas；這裡只控制它什麼時候完成。
vi.mock("../MyExams/importPastExam", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../MyExams/importPastExam")>()),
  importPastExam: ({ exam, onProgress, signal }: { exam: PastExam; onProgress?: (done: number, total: number) => void; signal?: AbortSignal }) =>
    new Promise<string>((resolve, reject) => {
      mocks.imports.push({ examId: exam.id, onProgress, signal, resolve, reject });
    }),
}));
vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);

import type { PastExam, PastExamCollection } from "../../lib/pastExams/types";
import { navigation, resetNavigation } from "../../testing/nextNavigation";
import { makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import { logger } from "../../utils/logger";
import { PastExamImportError } from "../MyExams/importPastExam";
import { ExamPreview, type ExamPreviewHandle } from "./ExamPreview";
import { makeSource } from "../../testing/questionBankFixtures";
import { mockStore, resetMockStore } from "../../services/mockStore";
import { resetPastExamSelection } from "./selectionState";
vi.mock("../MyExams/CropEditorWorkspace", async () => {
  const { useImperativeHandle } = await import("react");
  return { CropEditorWorkspace: ({ ref, source }: { ref: import("react").Ref<{ flush: () => Promise<boolean> }>; source: { id: string } }) => {
    useImperativeHandle(ref, () => ({ flush: mocks.flush }));
    return <div data-editor={source.id} />;
  } };
});
const previewRef = createRef<ExamPreviewHandle>();

const pdfExam = makeExam({ school: "民權國小" });
const otherPdf = makeExam({ school: "大同國小" });
const wordExam = makeExam({ school: "安和國小", format: "word" });

let container: HTMLDivElement;
let root: Root;

function render(exam: PastExam | null, collection: PastExamCollection = MATH_5A) {
  act(() =>
    root.render(
      <ExamPreview
        ref={previewRef}
        exam={exam}
        view="question"
        onViewChange={() => {}}
        collection={collection}
        hasPrevious={false}
        hasNext={false}
        onPrevious={() => {}}
        onNext={() => {}}
        onClose={() => {}}
      />,
    ),
  );
}

function importButton(): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>("button[data-import-exam]");
}

function alertText(): string {
  return [...container.querySelectorAll('[role="alert"]')].map((item) => item.textContent).join("\n");
}

async function settle() {
  await act(async () => {
    for (let round = 0; round < 5; round += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  resetNavigation();
  resetMockStore();
  resetPastExamSelection();
  mocks.flush.mockReset().mockResolvedValue(true);
  mocks.imports.length = 0;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("ExamPreview import", () => {
  it("offers 框選題目 for PDF exams", () => {
    render(pdfExam);
    expect(importButton()?.getAttribute("aria-label")).toBe("框選題目");
    expect(importButton()?.disabled).toBe(false);
  });

  it("does not offer it for Word files or subjects the question bank lacks", () => {
    render(wordExam);
    expect(importButton()).toBeNull();
    render(pdfExam, { ...MATH_5A, subject: "music", subjectLabel: "音樂" });
    expect(importButton()).toBeNull();
  });

  it("prepares pages and opens the embedded editor without navigating", async () => {
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    expect(mocks.imports).toHaveLength(1);
    act(() => mocks.imports[0].onProgress?.(2, 5));
    expect(importButton()!.getAttribute("aria-label")).toBe("準備中 2/5・取消");
    mockStore.sources.set("source-1", makeSource());
    mocks.imports[0].resolve("source-1");
    await settle();
    expect(container.querySelector("[data-editor]")?.getAttribute("data-editor")).toBe("source-1");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("reuses the newest matching source and waits for save before browsing", async () => {
    const meta = { examId: pdfExam.id, datasetId: pdfExam.datasetId, examType: pdfExam.examType, academicYear: pdfExam.academicYear };
    mockStore.sources.set("old", makeSource({ id: "old", pastExam: meta }));
    mockStore.sources.set("new", makeSource({ id: "new", pastExam: meta, updatedAt: new Date("2030-01-01") }));
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    expect(mocks.imports).toHaveLength(0);
    expect(container.querySelector("[data-editor]")?.getAttribute("data-editor")).toBe("new");
    mocks.flush.mockResolvedValue(false);
    act(() => importButton()!.click());
    await settle();
    expect(container.querySelector("[data-editor]")).not.toBeNull();
    expect(alertText()).toContain("儲存失敗");
    mocks.flush.mockResolvedValue(true);
    act(() => importButton()!.click());
    await settle();
    expect(container.querySelector("[data-editor]")).toBeNull();
    expect(container.querySelector("[data-pdf-viewer]")).not.toBeNull();
  });

  it("cancels preparation and ignores a late completion", async () => {
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    act(() => importButton()!.click());
    await settle();
    expect(mocks.imports[0].signal?.aborted).toBe(true);
    mocks.imports[0].resolve("late");
    await settle();
    expect(importButton()?.getAttribute("aria-label")).toBe("框選題目");
    expect(container.querySelector("[data-editor]")).toBeNull();
  });

  it("shows the error next to the header and lets the user retry", async () => {
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    mocks.imports[0].reject(new PastExamImportError("下載考卷失敗（HTTP 403），請稍後再試"));
    await settle();

    expect(alertText()).toBe("下載考卷失敗（HTTP 403），請稍後再試");
    expect(container.querySelector("[data-pdf-viewer]")).not.toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(importButton()!.disabled).toBe(false);

    act(() => importButton()!.click());
    await settle();
    expect(alertText()).toBe("");
    expect(mocks.imports).toHaveLength(2);
  });

  it("uses a generic message for unexpected errors", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    mocks.imports[0].reject(new Error("boom"));
    await settle();
    expect(alertText()).toBe("準備失敗，請重試");
    expect(logger.error).toHaveBeenCalled();
  });

  it("drops an import when another exam is opened", async () => {
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    render(otherPdf);

    expect(mocks.imports[0].signal?.aborted).toBe(true);
    expect(importButton()!.disabled).toBe(false);
    expect(importButton()!.getAttribute("aria-label")).toBe("框選題目");

    mocks.imports[0].resolve("stale");
    await settle();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(alertText()).toBe("");

    // 回到原本那份也不會殘留「匯入中」
    render(pdfExam);
    expect(importButton()!.disabled).toBe(false);
  });

  it("does not navigate once the preview has unmounted", async () => {
    render(pdfExam);
    act(() => importButton()!.click());
    await settle();
    act(() => root.unmount());

    expect(mocks.imports[0].signal?.aborted).toBe(true);
    mocks.imports[0].resolve("late");
    await settle();
    expect(navigation.push).not.toHaveBeenCalled();
    // afterEach 還會再 unmount 一次
    root = createRoot(container);
  });
});
