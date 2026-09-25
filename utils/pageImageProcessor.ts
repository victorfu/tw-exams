import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  MAX_UPLOAD_FILE_BYTES,
  PAGE_JPEG_QUALITY,
} from "../constants/questionBank";
import { logger } from "./logger";

export type PageRotation = 0 | 90 | 180 | 270;

export interface PageInput {
  /** 穩定的 React key。 */
  key: string;
  file: File;
  kind: "image" | "pdf";
  /** PDF 頁碼（1 起算）；照片沒有。 */
  pdfPageNumber?: number;
  /** 使用者在預覽時加上的順時針旋轉。 */
  rotation: PageRotation;
}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

export interface FileReadError {
  fileName: string;
  message: string;
}

export const UNREADABLE_FILE_MESSAGE = "無法讀取，請轉成 JPG 或 PDF";
/** PDF 讀取工具本身沒載入成功（例如改版後舊的程式碼檔不見了），跟檔案無關。 */
export const PDF_ENGINE_FAILED_MESSAGE = "PDF 讀取工具載入失敗，請重新整理頁面後再試";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type PdfDocument = PDFDocumentProxy;

/** 同一個 PDF 檔只開一次；上傳完或關閉對話框時用 releasePdfFiles 釋放。 */
const pdfDocuments = new WeakMap<File, Promise<PdfDocument>>();
let keySequence = 0;

export function fitLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const ratio = maxLongEdge / longEdge;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

export function rotatedSize(
  width: number,
  height: number,
  rotation: PageRotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

export function nextRotation(rotation: PageRotation): PageRotation {
  return ((rotation + 90) % 360) as PageRotation;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

class PdfEngineLoadError extends Error {
  constructor(cause: unknown) {
    super("pdf.js failed to load", { cause });
    this.name = "PdfEngineLoadError";
  }
}

function loadPdfjs() {
  // pdfjs 只能在瀏覽器載入（伺服器端 render 時沒有 DOMMatrix 等 API），所以用到才載。
  return import("./pdfConfig").catch((error: unknown) => {
    throw new PdfEngineLoadError(error);
  });
}

function loadPdf(file: File): Promise<PdfDocument> {
  const cached = pdfDocuments.get(file);
  if (cached) return cached;
  const loading = Promise.all([file.arrayBuffer(), loadPdfjs()]).then(
    async ([data, { pdfjs, pdfDocumentOptions }]) => {
      const task = pdfjs.getDocument({ data, ...pdfDocumentOptions });
      try {
        return await task.promise;
      } catch (error) {
        // 開檔失敗時 pdf.js 不會自己關掉 worker，要 destroy，否則 worker 和整份檔案會留到關分頁
        await task.destroy().catch(() => {});
        throw error;
      }
    },
  );
  pdfDocuments.set(file, loading);
  // 失敗的結果不留在快取，再選一次同一個檔案會重新開
  loading.catch(() => {
    if (pdfDocuments.get(file) === loading) pdfDocuments.delete(file);
  });
  return loading;
}

function nextKey(): string {
  keySequence += 1;
  return `page-${keySequence}`;
}

/** 把選到的檔案展開成頁；PDF 只讀頁數，不 render（spec §7 步驟 2）。 */
export async function expandFilesToPages(
  files: readonly File[],
): Promise<{ pages: PageInput[]; errors: FileReadError[] }> {
  const pages: PageInput[] = [];
  const errors: FileReadError[] = [];

  for (const file of files) {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      errors.push({ fileName: file.name, message: "檔案超過 50MB，請拆開上傳" });
      continue;
    }
    if (isPdf(file)) {
      try {
        const pdf = await loadPdf(file);
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          pages.push({ key: nextKey(), file, kind: "pdf", pdfPageNumber: pageNumber, rotation: 0 });
        }
      } catch (error) {
        logger.warn("[pageImageProcessor] PDF load failed", file.name, error);
        errors.push({
          fileName: file.name,
          message: error instanceof PdfEngineLoadError ? PDF_ENGINE_FAILED_MESSAGE : UNREADABLE_FILE_MESSAGE,
        });
      }
      continue;
    }
    if (IMAGE_TYPES.has(file.type)) {
      pages.push({ key: nextKey(), file, kind: "image", rotation: 0 });
      continue;
    }
    errors.push({ fileName: file.name, message: UNREADABLE_FILE_MESSAGE });
  }

  return { pages, errors };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

async function drawPdfPage(
  canvas: HTMLCanvasElement,
  input: PageInput,
  maxLongEdge: number,
): Promise<void> {
  const pdf = await loadPdf(input.file);
  const page = await pdf.getPage(input.pdfPageNumber ?? 1);
  const base = page.getViewport({ scale: 1 });
  const scale = maxLongEdge / Math.max(base.width, base.height);
  const viewport = page.getViewport({
    scale,
    rotation: (page.rotate + input.rotation) % 360,
  });
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport, background: "rgb(255,255,255)" }).promise;
  page.cleanup();
}

async function drawImageFile(
  canvas: HTMLCanvasElement,
  input: PageInput,
  maxLongEdge: number,
): Promise<void> {
  const bitmap = await createImageBitmap(input.file, { imageOrientation: "from-image" });
  try {
    const fitted = fitLongEdge(bitmap.width, bitmap.height, maxLongEdge);
    const size = rotatedSize(fitted.width, fitted.height, input.rotation);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas 2d context unavailable");
    // 透明 PNG 轉 JPEG 會變黑底，先鋪白。
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.translate(size.width / 2, size.height / 2);
    context.rotate((input.rotation * Math.PI) / 180);
    context.drawImage(bitmap, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height);
  } finally {
    bitmap.close();
  }
}

/**
 * 把一頁渲染成 JPEG。呼叫端一次只處理一頁：用完的 canvas 會立刻歸零，
 * 避免 iPhone Safari 記憶體爆掉（spec §7）。
 */
export async function renderPage(
  input: PageInput,
  maxLongEdge: number,
): Promise<RenderedPage> {
  const canvas = document.createElement("canvas");
  try {
    if (input.kind === "pdf") {
      await drawPdfPage(canvas, input, maxLongEdge);
    } else {
      await drawImageFile(canvas, input, maxLongEdge);
    }
    const blob = await canvasToJpeg(canvas, PAGE_JPEG_QUALITY);
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function releasePdfFiles(files: readonly File[]): Promise<void> {
  for (const file of files) {
    const loading = pdfDocuments.get(file);
    if (!loading) continue;
    pdfDocuments.delete(file);
    try {
      await (await loading).destroy();
    } catch {
      // 讀取失敗的 PDF 沒有東西要釋放
    }
  }
}
