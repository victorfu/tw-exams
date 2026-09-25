import * as pdfjs from "pdfjs-dist";

export { pdfjs };

// Configure PDF.js worker globally (called once at app startup)
export function initializePdfjs() {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// Passed to every getDocument call for proper font rendering
export const pdfDocumentOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

// Initialize immediately when this module is imported
initializePdfjs();
