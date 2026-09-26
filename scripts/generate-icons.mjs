// 由 app/icon.svg 產生 app/favicon.ico（16、32px，內嵌 PNG）與 app/apple-icon.png（180px，滿版不透明）。
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url));
const png = (size, input = svg) => sharp(input, { density: 72 * (size / 64) * 4 }).resize(size, size).png().toBuffer();

const images = await Promise.all([16, 32].map((size) => png(size)));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const size = [16, 32][i];
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));

// iOS 會自己裁圓角：用直角滿版底色。
const svgText = svg.toString();
const squareText = svgText.replace('rx="14" ', "");
if (squareText === svgText) throw new Error('icon.svg no longer contains rx="14" — update generate-icons.mjs');
const square = Buffer.from(squareText);
await writeFile(new URL("../app/apple-icon.png", import.meta.url), await png(180, square));
