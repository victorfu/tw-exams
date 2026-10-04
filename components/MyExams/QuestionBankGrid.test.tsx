import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { navigation, setLocation, resetNavigation } from "../../testing/nextNavigation";

const mocks = vi.hoisted(() => ({ useSignedPageUrls: vi.fn() }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: mocks.useSignedPageUrls }));

import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { readSelectionDraft, resetWorkspaceState } from "./workspaceState";
import { QuestionBankGrid } from "./QuestionBankGrid";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetNavigation();
  resetWorkspaceState();
  setLocation("/my-exams");
  navigation.replace.mockImplementation((href) => setLocation(href));
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  mocks.useSignedPageUrls.mockReturnValue({ urls: {}, failed: false, refresh: vi.fn() });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderGrid(questions = [
  makeQuestion({ id: "m1", subject: "math" }),
  makeQuestion({ id: "m2", subject: "math" }),
  makeQuestion({ id: "c1", subject: "chinese" }),
]) {
  act(() =>
    root.render(
      <QuestionBankGrid sources={[makeSource()]} questions={questions} onUpload={vi.fn()} />,
    ),
  );
}

function chip(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.startsWith(label),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`chip not found: ${label}`);
  return button;
}

describe("QuestionBankGrid", () => {
  it("shows subject counts and filters the cards", () => {
    renderGrid();
    expect(chip("全部").textContent).toBe("全部 3");
    expect(chip("數學").textContent).toBe("數學 2");
    expect(container.querySelectorAll("li")).toHaveLength(3);

    act(() => chip("國語").click());
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("previews before editing, preserves the return filters, and restores focus", () => {
    setLocation("/my-exams?subject=math");
    renderGrid([makeQuestion({ id: "m1" })]);
    const trigger = chip("預覽題目");
    trigger.focus();
    act(() => trigger.click());
    expect(container.querySelector("dialog")?.open).toBe(true);
    const url = new URL(container.querySelector("dialog a")!.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/my-exams/sources/source-1");
    expect(url.searchParams.get("q")).toBe("m1");
    expect(url.searchParams.get("returnTo")).toBe("/my-exams?subject=math");
    const close = container.querySelector<HTMLButtonElement>("dialog button")!;
    const edit = container.querySelector<HTMLAnchorElement>("dialog a")!;
    edit.focus();
    act(() => edit.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(close);
    act(() => close.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(edit);
    act(() => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the image retry outside the card link", () => {
    const refresh = vi.fn();
    mocks.useSignedPageUrls.mockReturnValue({
      urls: { [makePage().storagePath]: "blob:page-0" },
      failed: false,
      refresh,
    });
    renderGrid([makeQuestion({ id: "m1" })]);
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });

    // <a> 裡不能放 <button>：重試要是連結的兄弟，而不是子孫
    expect(container.querySelector("a button")).toBeNull();
    expect(container.querySelector("button button")).toBeNull();

    const retry = [...container.querySelectorAll("button")].find((item) => item.textContent === "重試");
    act(() => retry?.click());
    expect(refresh).toHaveBeenCalledWith(makePage().storagePath);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("shows an upload call to action when the bank is empty", () => {
    renderGrid([]);
    expect(container.textContent).toContain("題庫還是空的");
  });
});


describe("bank workspace interactions", () => {
  it("intersects source, subject and case-insensitive title search without renumbering", () => {
    setLocation("/my-exams?subject=math&source=source-1&search=%20MATH%20");
    act(() => root.render(<QuestionBankGrid sources={[makeSource({ title: "Math test" }), makeSource({ id: "other", title: "Math other" })]}
      questions={[makeQuestion({ id: "a", subject: "chinese" }), makeQuestion({ id: "b" }), makeQuestion({ id: "c", sourceId: "other" })]} onUpload={vi.fn()} />));
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.querySelector("article")?.textContent).toContain("第 2 題");
    expect(container.querySelectorAll("select option")).toHaveLength(3);
    act(() => setLocation("/my-exams?source=missing&subject=invalid"));
    expect(container.querySelectorAll("article")).toHaveLength(3);
    act(() => setLocation("/my-exams?search=not-found"));
    expect(container.textContent).toContain("沒有符合的題目");
    act(() => chip("清除篩選").click());
    expect(navigation.replace).toHaveBeenLastCalledWith("/my-exams", { scroll: false });
    expect(container.querySelectorAll("article")).toHaveLength(3);
  });

  it("retains selection across filters and remounts and passes click order to the composer", () => {
    renderGrid();
    act(() => chip("選題模式").click());
    const check = (index: number) => container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index];
    // default order is c1, m1, m2; deliberately choose the reverse of display order
    act(() => check(2).click());
    act(() => chip("國語").click());
    expect(container.textContent).toContain("其中 1 題未顯示");
    act(() => check(0).click());
    act(() => root.render(<div>來源分頁</div>));
    renderGrid();
    expect(container.textContent).toContain("已選 2 題");
    act(() => chip("用這些題目組卷").click());
    const href = navigation.push.mock.lastCall![0];
    const token = new URL(href, "http://localhost").searchParams.get("selection")!;
    expect(readSelectionDraft(token)).toEqual({ ids: ["m2", "c1"], returnTo: "/my-exams?subject=chinese" });
    act(() => chip("清除選取").click());
    expect(chip("用這些題目組卷").disabled).toBe(true);
    act(() => chip("退出選題").click());
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("keeps all blocks and deduplicates page labels in the preview", () => {
    const region = makeQuestion().regions[0];
    renderGrid([makeQuestion({ regions: [region, region] })]);
    expect(container.querySelector("article")?.textContent).toContain("第 1 頁");
    act(() => chip("預覽題目").click());
    expect(container.querySelectorAll('dialog [data-testid="question-crop-region"]')).toHaveLength(2);
  });
});
