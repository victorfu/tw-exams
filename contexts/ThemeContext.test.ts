import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT } from "./themeInit";

function runInit(systemDark: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: systemDark }));
  localStorage.clear();
  new Function(THEME_INIT_SCRIPT)();
  return document.documentElement.getAttribute("data-theme");
}

afterEach(() => vi.unstubAllGlobals());

describe("THEME_INIT_SCRIPT", () => {
  it("uses the paopao themes", () => {
    expect(runInit(false)).toBe("paopaolight");
    expect(runInit(true)).toBe("paopaodark");
  });
});
