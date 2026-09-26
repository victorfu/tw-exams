import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/font 只在 Next 的編譯流程裡能用；測試只需要它回傳的 CSS 變數 class。
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font-variable" });
  return { Huninn: font, Noto_Sans_TC: font };
});

import RootLayout from "./layout";

function renderLayout(): Document {
  const html = renderToStaticMarkup(
    <RootLayout params={Promise.resolve({})}>
      <p>內容</p>
    </RootLayout>,
  );
  return new DOMParser().parseFromString(`<!DOCTYPE html>${html}`, "text/html");
}

/** <head> 裡瀏覽器解析到就會同步執行的 inline script（不是 src／async／defer／module）。 */
function blockingHeadScripts(doc: Document): HTMLScriptElement[] {
  return [...doc.head.querySelectorAll("script")].filter(
    (script) =>
      !script.src &&
      !script.async &&
      !script.defer &&
      (!script.type || script.type === "text/javascript"),
  );
}

/** 在測試的 window 上跑一段 script 原始碼（jsdom 不會執行插入的 <script>）。 */
function runScript(source: string) {
  new Function(source)();
}

describe("RootLayout theme init", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.setAttribute("data-theme", "paopaolight");
    // jsdom 沒有 matchMedia；預設系統為淺色。
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("server-renders the light theme as the default", () => {
    expect(renderLayout().documentElement.getAttribute("data-theme")).toBe("paopaolight");
  });

  it("applies the saved theme from a blocking inline script in <head>", () => {
    // 必須是瀏覽器解析 <head> 時就執行的 script，才會在第一次繪製前生效；
    // next/script 的 beforeInteractive 只會排進 self.__next_s，等 Next runtime 載入後才跑。
    const [script] = blockingHeadScripts(renderLayout());
    expect(script).toBeDefined();

    localStorage.setItem("ollie-theme", "dark");
    runScript(script.textContent ?? "");
    expect(document.documentElement.getAttribute("data-theme")).toBe("paopaodark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows a dark OS preference when nothing is saved", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const [script] = blockingHeadScripts(renderLayout());
    runScript(script?.textContent ?? "");
    expect(document.documentElement.getAttribute("data-theme")).toBe("paopaodark");
  });
});
