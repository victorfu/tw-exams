// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyPdfjsAssets, PDFJS_ASSET_PATHS } from "./pdfjsAssets";

let root: string;
let packageDir: string;
let publicDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pdfjs-assets-"));
  packageDir = join(root, "pdfjs-dist");
  publicDir = join(root, "public");
  await mkdir(join(packageDir, "legacy", "build"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ version: "9.9.9" }));
  await writeFile(join(packageDir, "legacy", "build", "pdf.worker.min.mjs"), "worker");
  for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
    await mkdir(join(packageDir, dir));
    await writeFile(join(packageDir, dir, "file"), dir);
  }
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("copyPdfjsAssets", () => {
  it("copies every runtime asset under a versioned folder", async () => {
    expect(await copyPdfjsAssets({ packageDir, publicDir })).toBe("9.9.9");
    for (const path of PDFJS_ASSET_PATHS) {
      expect(existsSync(join(publicDir, "pdfjs", "9.9.9", path)), path).toBe(true);
    }
    expect(existsSync(join(publicDir, "pdfjs", "9.9.9", "wasm", "file"))).toBe(true);
  });

  it("removes the folder of a previous pdfjs-dist version", async () => {
    await mkdir(join(publicDir, "pdfjs", "1.0.0"), { recursive: true });
    await copyPdfjsAssets({ packageDir, publicDir });
    expect(existsSync(join(publicDir, "pdfjs", "1.0.0"))).toBe(false);
  });
});
