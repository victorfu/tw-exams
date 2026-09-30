// 產生 public/og-image.png（1200×630）：分享到 LINE、Facebook 時的預覽圖。
// 文字用系統的「Noto Sans TC」畫進 PNG，所以要在裝了這套字的機器上跑，產出的圖直接 commit。
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const icon = (await readFile(new URL("../app/icon.svg", import.meta.url), "utf8"))
  .replace("<svg ", '<svg x="96" y="96" width="176" height="176" ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F3F8FE"/>
  <circle cx="1080" cy="80" r="220" fill="#2F9BF0" opacity="0.12"/>
  <circle cx="1010" cy="560" r="170" fill="#3DD6B5" opacity="0.18"/>
  <circle cx="120" cy="600" r="90" fill="#2F9BF0" opacity="0.08"/>
  ${icon}
  <g font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" fill="#1F3A5F">
    <text x="304" y="210" font-size="92" font-weight="700">泡泡考卷</text>
    <text x="96" y="390" font-size="60" font-weight="700">國小考古題一次找齊，</text>
    <text x="96" y="470" font-size="60" font-weight="700"><tspan fill="#1E7FD6">考卷</tspan>也能自己組</text>
    <text x="96" y="552" font-size="32" fill="#4A6482">線上預覽・看解答・下載｜免費、不用註冊</text>
  </g>
</svg>`;

await writeFile(new URL("../public/og-image.png", import.meta.url), await sharp(Buffer.from(svg)).png().toBuffer());
