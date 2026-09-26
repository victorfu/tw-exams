import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Page images are in-memory blob: URLs, which next/image cannot optimize.
    files: ["components/MyExams/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Python CLI (its .venv bundles third-party JS).
    "cli/**",
    // pdf.js runtime files copied from node_modules by `npm run pdfjs-assets`.
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
