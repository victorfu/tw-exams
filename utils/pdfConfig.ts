// The legacy build bundles polyfills (e.g. Promise.withResolvers) that the modern build
// expects natively; without them every PDF fails on Safari < 17.4, which Next.js still
// supports (Safari 16.4+). The worker must come from the same legacy build.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export { pdfjs };

// Configure PDF.js worker globally (called once at app startup)
export function initializePdfjs() {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
}

// Passed to every getDocument call for proper font rendering
export const pdfDocumentOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  // Wasm decoders for JPEG 2000 (JPXDecode) images and ICC colors; without them
  // scanned pages that use JPX render as blank white pages.
  wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/wasm/`,
  iccUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/iccs/`,
};

// Initialize immediately when this module is imported
initializePdfjs();
