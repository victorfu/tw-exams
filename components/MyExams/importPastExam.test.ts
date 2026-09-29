import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageInput, RenderedPage } from "../../utils/pageImageProcessor";

const mocks = vi.hoisted(() => ({
  expandFilesToPages: vi.fn(),
  renderPage: vi.fn(),
  releasePdfFiles: vi.fn(async () => {}),
  createSource: vi.fn(),
}));

// 真正的展開與 render 要 pdf.js、canvas；這裡只看呼叫順序與參數。
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

import { MAX_SOURCE_PAGES, PAGE_LONG_EDGE_PX } from "../../constants/questionBank";
import type { PastExamCollection } from "../../lib/pastExams/types";
import type { CreateSourceInput } from "../../services/questionSourceService";
import { makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import { logger } from "../../utils/logger";
import { PDF_ENGINE_FAILED_MESSAGE, UNREADABLE_FILE_MESSAGE } from "../../utils/pageImageProcessor";
import { bankSubjectOf, importPastExam, pastExamSourceTitle, PastExamImportError } from "./importPastExam";

const exam = makeExam({ academicYear: 114, city: "臺北市", school: "民權國小", periodLabel: "期中1", file: "pdf/math/民權.pdf" });

function pdfPages(file: File, count: number): { pages: PageInput[]; errors: [] } {
  return {
    pages: Array.from({ length: count }, (_, index) => ({
      key: `page-${index + 1}`,
      file,
      kind: "pdf",
      pdfPageNumber: index + 1,
      rotation: 0,
    })),
    errors: [],
  };
}

function rendered(size: number): RenderedPage {
  return { blob: new Blob(["jpeg"]), width: size, height: size };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(new Blob(["%PDF-1.7"], { type: "application/pdf" })));
  vi.stubGlobal("fetch", fetchMock);
  mocks.expandFilesToPages.mockReset().mockImplementation(async (files: File[]) => pdfPages(files[0], 3));
  mocks.renderPage.mockReset().mockImplementation(async (_input: PageInput, size: number) => rendered(size));
  mocks.releasePdfFiles.mockClear();
  // 跟真正的 createSource 一樣：一頁存好才要下一頁。
  mocks.createSource.mockReset().mockImplementation(async (input: CreateSourceInput) => {
    for (let index = 0; index < input.pageCount; index += 1) {
      await input.renderPage(index);
      input.onProgress?.(index + 1, input.pageCount);
    }
    return { id: input.sourceId };
  });
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function importError(promise: Promise<unknown>): Promise<PastExamImportError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PastExamImportError);
  return error as PastExamImportError;
}

describe("bankSubjectOf", () => {
  it("maps the past-exam subjects to question-bank subjects", () => {
    expect(bankSubjectOf("chinese")).toBe("chinese");
    expect(bankSubjectOf("math")).toBe("math");
    expect(bankSubjectOf("science")).toBe("science");
    expect(bankSubjectOf("social-studies")).toBe("social");
    expect(bankSubjectOf("english")).toBe("english");
    expect(bankSubjectOf("music")).toBeNull();
  });
});

describe("pastExamSourceTitle", () => {
  it("reads like 學年 縣市 學校 考試別 and skips missing parts", () => {
    expect(pastExamSourceTitle(exam)).toBe("114上 臺北市 民權國小 期中1");
    expect(pastExamSourceTitle({ ...exam, city: null, school: null })).toBe("114上 期中1");
  });
});

describe("importPastExam", () => {
  it("downloads the PDF and stores every page as a new source", async () => {
    const onProgress = vi.fn();

    const sourceId = await importPastExam({ exam, collection: MATH_5A, onProgress });

    expect(sourceId).toBe("new-source");
    expect(fetchMock).toHaveBeenCalledWith(
      "/exams/pdf/math/%E6%B0%91%E6%AC%8A.pdf",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    const [files] = mocks.expandFilesToPages.mock.calls[0] as [File[]];
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe("application/pdf");
    expect(files[0].name).toMatch(/\.pdf$/);

    const input = mocks.createSource.mock.calls[0][0] as CreateSourceInput;
    expect(input).toMatchObject({
      sourceId: "new-source",
      title: "114上 臺北市 民權國小 期中1",
      subject: "math",
      pageCount: 3,
      pastExam: {
        examId: exam.id,
        datasetId: exam.datasetId,
        examType: exam.examType,
        academicYear: exam.academicYear,
      },
    });
    expect(mocks.renderPage.mock.calls.map(([page, size]) => [(page as PageInput).pdfPageNumber, size])).toEqual([
      [1, PAGE_LONG_EDGE_PX],
      [2, PAGE_LONG_EDGE_PX],
      [3, PAGE_LONG_EDGE_PX],
    ]);
    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(mocks.releasePdfFiles).toHaveBeenCalledWith(files);
  });

  it("files social-studies exams under 社會", async () => {
    const social: PastExamCollection = { ...MATH_5A, id: "social", subject: "social-studies", subjectLabel: "社會" };
    await importPastExam({ exam, collection: social });
    expect((mocks.createSource.mock.calls[0][0] as CreateSourceInput).subject).toBe("social");
  });

  it("refuses subjects the question bank does not have, before downloading", async () => {
    const music: PastExamCollection = { ...MATH_5A, id: "music", subject: "music", subjectLabel: "音樂" };
    const error = await importError(importPastExam({ exam, collection: music }));
    expect(error.message).toBe("「音樂」還不能匯入自製考卷");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses Word files, before downloading", async () => {
    const error = await importError(importPastExam({ exam: { ...exam, format: "word" }, collection: MATH_5A }));
    expect(error.message).toBe("Word 檔無法匯入，只能匯入 PDF 考卷");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the HTTP status when the download fails", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const error = await importError(importPastExam({ exam, collection: MATH_5A }));
    expect(error.message).toBe("下載考卷失敗（HTTP 403），請稍後再試");
    expect(mocks.createSource).not.toHaveBeenCalled();
  });

  it("reports a network error when the download does not go through", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await importError(importPastExam({ exam, collection: MATH_5A }));
    expect(error.message).toBe("無法下載考卷，請檢查網路後再試");
  });

  it("says the PDF is unreadable and still releases it", async () => {
    mocks.expandFilesToPages.mockImplementation(async (files: File[]) => ({
      pages: [],
      errors: [{ fileName: files[0].name, message: UNREADABLE_FILE_MESSAGE }],
    }));
    const error = await importError(importPastExam({ exam, collection: MATH_5A }));
    expect(error.message).toBe("考卷 PDF 無法讀取");
    expect(mocks.createSource).not.toHaveBeenCalled();
    expect(mocks.releasePdfFiles).toHaveBeenCalledTimes(1);
  });

  it("passes on the message when pdf.js itself failed to load", async () => {
    mocks.expandFilesToPages.mockImplementation(async (files: File[]) => ({
      pages: [],
      errors: [{ fileName: files[0].name, message: PDF_ENGINE_FAILED_MESSAGE }],
    }));
    const error = await importError(importPastExam({ exam, collection: MATH_5A }));
    expect(error.message).toBe(PDF_ENGINE_FAILED_MESSAGE);
  });

  it("refuses exams with more pages than a source can hold", async () => {
    mocks.expandFilesToPages.mockImplementation(async (files: File[]) => pdfPages(files[0], MAX_SOURCE_PAGES + 1));
    const error = await importError(importPastExam({ exam, collection: MATH_5A }));
    expect(error.message).toBe(`考卷共 ${MAX_SOURCE_PAGES + 1} 頁，超過自製考卷一次 ${MAX_SOURCE_PAGES} 頁的上限`);
    expect(mocks.createSource).not.toHaveBeenCalled();
    expect(mocks.releasePdfFiles).toHaveBeenCalledTimes(1);
  });

  it("says which page failed and releases the PDF", async () => {
    mocks.renderPage.mockImplementation(async (input: PageInput, size: number) => {
      if (input.pdfPageNumber === 2) throw new Error("canvas out of memory");
      return rendered(size);
    });
    const error = await importError(importPastExam({ exam, collection: MATH_5A }));
    expect(error.message).toBe("第 2 頁處理失敗，請重試");
    expect(mocks.releasePdfFiles).toHaveBeenCalledTimes(1);
  });

  it("stops rendering pages once aborted and does not report it as a failure", async () => {
    const controller = new AbortController();
    mocks.renderPage.mockImplementation(async (_input: PageInput, size: number) => {
      controller.abort();
      return rendered(size);
    });

    const error = await importPastExam({ exam, collection: MATH_5A, signal: controller.signal }).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).not.toBeInstanceOf(PastExamImportError);
    expect((error as DOMException).name).toBe("AbortError");
    expect(mocks.renderPage).toHaveBeenCalledTimes(1);
    expect(mocks.releasePdfFiles).toHaveBeenCalledTimes(1);
  });
});
