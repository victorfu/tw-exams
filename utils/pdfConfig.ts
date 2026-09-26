// The legacy build bundles polyfills (e.g. Promise.withResolvers) that the modern build
// expects natively; without them every PDF fails on Safari < 17.4, which Next.js still
// supports (Safari 16.4+). The worker must come from the same legacy build.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export { pdfjs };

// scripts/copy-pdfjs-assets.ts（dev／build 前自動執行）把這些檔案放到 public/pdfjs/<版本>/，
// 同源載入：不依賴 unpkg，也能在擋第三方網域的網路下用。
const ASSET_BASE = `/pdfjs/${pdfjs.version}/`;

// Configure PDF.js worker globally (called once at app startup)
export function initializePdfjs() {
  pdfjs.GlobalWorkerOptions.workerSrc = `${ASSET_BASE}legacy/build/pdf.worker.min.mjs`;
}

// Passed to every getDocument call for proper font rendering
export const pdfDocumentOptions = {
  cMapUrl: `${ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
  // Wasm decoders for JPEG 2000 (JPXDecode) images and ICC colors; without them
  // scanned pages that use JPX render as blank white pages.
  wasmUrl: `${ASSET_BASE}wasm/`,
  iccUrl: `${ASSET_BASE}iccs/`,
};

// Initialize immediately when this module is imported
initializePdfjs();
