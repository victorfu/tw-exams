import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./PdfViewer", () => ({
  PdfViewer: ({ url, title }: { url: string; title: string }) => <div data-pdf-viewer={url} aria-label={title} />,
}));

vi.mock("next/navigation", async () => (await import("../../testing/nextNavigation")).nextNavigationModule);
import { followHistory, historyEntries, navigation, resetNavigation, setLocation } from "../../testing/nextNavigation";
import { installObserverStubs } from "../../testing/observers";
import { makeCatalog, makeExam, MATH_5A } from "../../testing/pastExamsFixtures";
import PastExamsPage from "./PastExamsPage";

const minquan = makeExam({ academicYear: 114, examType: "midterm", city: "臺北市", school: "民權國小", searchText: "114上|台北市 民權國小" });
const anhe = makeExam({ academicYear: 114, examType: "final", examRound: 2, periodLabel: "期末2", city: "新北市", school: "安和國小", available: false, bytes: null, searchText: "114上|新北市 安和國小" });
const datong = makeExam({ academicYear: 113, examType: "midterm", city: "臺北市", school: "大同國小", format: "word", searchText: "113上|台北市 大同國小" });
const zhongzheng = makeExam({ academicYear: 112, examType: "final", examRound: 2, periodLabel: "期末2", city: "彰化縣", school: "中正國小", searchText: "112上|彰化縣 中正國小" });
const catalog = makeCatalog([zhongzheng, datong, anhe, minquan]);

let container: HTMLDivElement;
let root: Root;

function renderPage(path = "/past-exams") {
  setLocation(path);
  followHistory();
  act(() => root.render(<PastExamsPage catalog={catalog} />));
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent?.trim() === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${name}`);
  return found;
}

function row(school: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("[data-exam-id]")].find((item) =>
    item.textContent?.includes(school),
  );
  if (!found) throw new Error(`row not found: ${school}`);
  return found;
}

function viewer(): Element | null {
  return container.querySelector("[data-pdf-viewer]");
}

function listedSchools(): string[] {
  return [...container.querySelectorAll("[data-exam-id]")].map(
    (item) => item.querySelector("[data-school]")?.textContent ?? "",
  );
}

function currentParams(): URLSearchParams {
  return navigation.url.searchParams;
}

function press(key: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function typeInto(input: HTMLInputElement, value: string, { isComposing = false } = {}) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing }));
  });
}

function searchBox(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="search"]')!;
}

/** 模擬手機寬度（< md）或桌機。 */
function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: desktop, media: query }));
}

beforeEach(() => {
  resetNavigation();
  installObserverStubs();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PastExamsPage", () => {
  it("lists the first collection's exams, newest first", () => {
    renderPage();
    expect(listedSchools()).toEqual(["民權國小", "安和國小", "大同國小", "中正國小"]);
    expect(container.textContent).toContain("共 4 份");
  });

  it("only enables collections that have data", () => {
    renderPage();
    expect(button("五年級").disabled).toBe(false);
    expect(button("五年級").getAttribute("aria-pressed")).toBe("true");
    expect(button("四年級").disabled).toBe(true);
    expect(button("四年級").title).toBe("尚未收錄");
    expect(button("下學期").disabled).toBe(true);
    expect(button("英文").disabled).toBe(true);
    expect(button("數學").getAttribute("aria-pressed")).toBe("true");
  });

  it("opens on 數學 when the catalog lists another subject first", () => {
    const chinese = {
      ...MATH_5A,
      id: "chinese-grade-05-semester-1-hanlin",
      subject: "chinese",
      subjectLabel: "國語",
      publisher: "hanlin",
      publisherLabel: "翰林",
    };
    setLocation("/past-exams");
    followHistory();
    act(() =>
      root.render(
        <PastExamsPage
          catalog={makeCatalog([minquan, makeExam({ datasetId: chinese.id, school: "國語國小" })], [chinese, MATH_5A])}
        />,
      ),
    );

    expect(button("數學").getAttribute("aria-pressed")).toBe("true");
    expect(listedSchools()).toEqual(["民權國小"]);
  });

  it("writes filters to the URL", () => {
    renderPage();

    act(() => button("113上").click());
    expect(currentParams().get("c")).toBe(MATH_5A.id);
    expect(currentParams().get("year")).toBe("113");
    expect(listedSchools()).toEqual(["大同國小"]);

    act(() => button("113上").click());
    act(() => button("期末").click());
    expect(currentParams().get("year")).toBeNull();
    expect(currentParams().get("type")).toBe("final");
    expect(listedSchools()).toEqual(["安和國小", "中正國小"]);
  });

  it("filters by city and search text", () => {
    renderPage();

    const city = container.querySelector<HTMLSelectElement>('select[aria-label="縣市"]')!;
    act(() => {
      city.value = "臺北市";
      city.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(currentParams().get("city")).toBe("臺北市");
    expect(listedSchools()).toEqual(["民權國小", "大同國小"]);

    typeInto(container.querySelector<HTMLInputElement>('input[type="search"]')!, "台北 民權");
    expect(currentParams().get("q")).toBe("台北 民權");
    expect(listedSchools()).toEqual(["民權國小"]);

    act(() => button("清除篩選").click());
    expect(currentParams().get("city")).toBeNull();
    expect(currentParams().get("q")).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe("");
    expect(listedSchools()).toHaveLength(4);
  });

  it("follows the URL when the search is changed from elsewhere", () => {
    renderPage("/past-exams?q=民權");
    expect(searchBox().value).toBe("民權");
    expect(listedSchools()).toEqual(["民權國小"]);

    act(() => setLocation("/past-exams"));

    expect(searchBox().value).toBe("");
    expect(listedSchools()).toHaveLength(4);
    expect(button("清除篩選").disabled).toBe(true);
  });

  it("ignores a year or city from the URL that this collection does not have", () => {
    renderPage("/past-exams?year=110&city=臺東縣");

    expect(listedSchools()).toHaveLength(4);
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="縣市"]')!.value).toBe("");
    expect(button("清除篩選").disabled).toBe(true);
  });

  it("names downloads after the title, taking the extension from the file name only", () => {
    const noExtension = makeExam({ file: "pdf/v1.2/20002871" });
    setLocation(`/past-exams?id=${encodeURIComponent(noExtension.id)}`);
    followHistory();
    act(() => root.render(<PastExamsPage catalog={makeCatalog([noExtension])} />));

    expect(container.querySelector("a[download]")?.getAttribute("download")).toBe(`${noExtension.title}.pdf`);
  });

  it("previews a PDF when its row is clicked", () => {
    renderPage();
    expect(container.textContent).toContain("點左邊的考卷開始瀏覽");

    act(() => row("民權國小").click());

    expect(currentParams().get("id")).toBe(minquan.id);
    expect(row("民權國小").getAttribute("aria-current")).toBe("true");
    expect(viewer()?.getAttribute("data-pdf-viewer")).toBe(`/exams/${minquan.file}`);
  });

  it("keeps the new-tab link same-origin friendly (no noreferrer)", () => {
    renderPage();

    act(() => row("民權國小").click());

    // 不能帶 noreferrer：同源檢查在較舊的瀏覽器（無 Sec-Fetch-Site）靠 Referer 判斷同源，
    // noreferrer 會讓 Referer 消失，害這個連結一律被判成跨站而 403。
    const link = container.querySelector<HTMLAnchorElement>('a[aria-label="在新分頁開啟"]')!;
    expect(link.getAttribute("rel")?.split(/\s+/)).not.toContain("noreferrer");
  });

  it("offers a download instead of a preview for Word files", () => {
    renderPage();

    act(() => row("大同國小").click());

    expect(viewer()).toBeNull();
    expect(container.textContent).toContain("Word 檔無法在頁面內預覽");
    const download = container.querySelector<HTMLAnchorElement>("a[download]");
    expect(download?.getAttribute("href")).toBe(`/exams/${datong.file}?download=1`);
  });

  it("does not let an undownloaded exam be selected", () => {
    renderPage();
    expect(row("安和國小").disabled).toBe(true);
    expect(row("安和國小").textContent).toContain("未下載");
  });

  it("moves between exams with ← → and j k, skipping undownloaded ones", () => {
    renderPage(`/past-exams?id=${encodeURIComponent(minquan.id)}`);

    press("ArrowRight");
    expect(currentParams().get("id")).toBe(datong.id);
    press("j");
    expect(currentParams().get("id")).toBe(zhongzheng.id);
    press("ArrowRight");
    expect(currentParams().get("id")).toBe(zhongzheng.id);
    press("k");
    press("ArrowLeft");
    expect(currentParams().get("id")).toBe(minquan.id);
  });

  it("ignores arrow keys while typing in the search box", () => {
    renderPage(`/past-exams?id=${encodeURIComponent(minquan.id)}`);

    press("ArrowRight", container.querySelector('input[type="search"]')!);

    expect(currentParams().get("id")).toBe(minquan.id);
  });

  it("moves with the preview's previous and next buttons", () => {
    renderPage(`/past-exams?id=${encodeURIComponent(datong.id)}`);

    act(() => button("下一份").click());
    expect(currentParams().get("id")).toBe(zhongzheng.id);
    act(() => button("上一份").click());
    act(() => button("上一份").click());
    expect(currentParams().get("id")).toBe(minquan.id);
    expect(button("上一份").disabled).toBe(true);
  });

  it("labels year chips with the number only, keeping the full name for screen readers", () => {
    renderPage();

    const chip = button("114上");
    expect(chip.textContent).toBe("114");
    // 按鈕上已經寫了年度，不另外跳出 hover 提示
    expect(chip.hasAttribute("title")).toBe(false);
    expect(chip.closest('[role="group"]')?.getAttribute("aria-label")).toBe("學年度");
  });

  it("restores filters and the selected exam from the URL", () => {
    renderPage(`/past-exams?c=${MATH_5A.id}&year=113&id=${encodeURIComponent(datong.id)}`);

    expect(button("113上").getAttribute("aria-pressed")).toBe("true");
    expect(listedSchools()).toEqual(["大同國小"]);
    expect(container.textContent).toContain("Word 檔無法在頁面內預覽");
  });

  it("closes the preview", () => {
    renderPage(`/past-exams?id=${encodeURIComponent(minquan.id)}`);

    act(() => button("關閉預覽").click());

    expect(currentParams().get("id")).toBeNull();
    expect(viewer()).toBeNull();
  });

  it("waits for the input method to finish composing before searching", () => {
    renderPage(`/past-exams?id=${encodeURIComponent(minquan.id)}`);
    const input = searchBox();

    act(() => {
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    });
    typeInto(input, "ㄇㄧㄣˊ", { isComposing: true });

    expect(input.value).toBe("ㄇㄧㄣˊ");
    expect(currentParams().get("q")).toBeNull();
    expect(listedSchools()).toHaveLength(4);
    expect(viewer()).not.toBeNull();

    typeInto(input, "民", { isComposing: true });
    act(() => {
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "民" }));
    });

    expect(currentParams().get("q")).toBe("民");
    expect(listedSchools()).toEqual(["民權國小"]);
  });

  describe("on a phone", () => {
    beforeEach(() => stubViewport(false));

    it("opens the preview as a new history entry that Back closes", () => {
      renderPage();

      act(() => row("民權國小").click());
      expect(historyEntries).toHaveLength(2);
      expect(currentParams().get("id")).toBe(minquan.id);

      act(() => window.history.back());
      expect(currentParams().get("id")).toBeNull();
      expect(viewer()).toBeNull();
    });

    it("shows the PDF viewer on phones too", () => {
      renderPage();

      act(() => row("民權國小").click());

      expect(viewer()?.getAttribute("data-pdf-viewer")).toBe(`/exams/${minquan.file}`);
    });

    it("replaces the entry when moving between exams, and the close button goes back", () => {
      renderPage();

      act(() => row("民權國小").click());
      act(() => button("下一份").click());
      expect(historyEntries).toHaveLength(2);
      expect(currentParams().get("id")).toBe(datong.id);

      act(() => button("關閉預覽").click());
      expect(historyEntries).toHaveLength(1);
      expect(currentParams().get("id")).toBeNull();
    });

    it("closes a preview opened from a shared link without leaving the page", () => {
      renderPage(`/past-exams?id=${encodeURIComponent(minquan.id)}`);

      act(() => button("關閉預覽").click());

      expect(historyEntries).toHaveLength(1);
      expect(navigation.url.pathname).toBe("/past-exams");
      expect(currentParams().get("id")).toBeNull();
    });
  });

  it("keeps a single history entry on a desktop", () => {
    stubViewport(true);
    renderPage();

    act(() => row("民權國小").click());

    expect(historyEntries).toHaveLength(1);
    expect(currentParams().get("id")).toBe(minquan.id);
  });

  it("paints the selected subject and the heading tag in the subject colour", () => {
    renderPage();
    const pressed = [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find(
      (button) => button.textContent === "數學",
    )!;
    expect(pressed.style.getPropertyValue("--btn-color")).toBe("var(--subject-math)");
    expect(pressed.style.getPropertyValue("--btn-fg")).toBe("var(--subject-math-content)");
    expect(pressed.className).not.toContain("btn-primary");

    const tag = container.querySelector<HTMLElement>("header [data-subject-tag]")!;
    expect(tag.textContent).toBe("數學");
    expect(tag.style.backgroundColor).toBe("var(--subject-math-tint)");
  });

  describe("answer sheets", () => {
    const withPdfAnswer = makeExam({
      school: "光明國小",
      answer: { file: "pdf/ds/answers/a.pdf", format: "pdf", pages: 2, bytes: 10 },
    });
    const withWordAnswer = makeExam({
      school: "文化國小",
      answer: { file: "doc/ds/answers/b.docx", format: "word", pages: null, bytes: 10 },
    });
    const wordWithPdfAnswer = makeExam({
      school: "混合國小",
      file: "doc/ds/c.doc",
      format: "word",
      answer: { file: "pdf/ds/answers/c.pdf", format: "pdf", pages: 1, bytes: 10 },
    });
    const noAnswer = makeExam({ school: "沒有國小" });
    const answers = makeCatalog([withPdfAnswer, withWordAnswer, wordWithPdfAnswer, noAnswer]);

    function renderAnswers(path: string) {
      setLocation(path);
      followHistory();
      act(() => root.render(<PastExamsPage catalog={answers} />));
    }

    const open = (exam: { id: string }, view = "") =>
      `/past-exams?id=${encodeURIComponent(exam.id)}${view ? `&view=${view}` : ""}`;

    it("marks rows that have an answer sheet", () => {
      renderAnswers("/past-exams");
      expect(row("光明國小").textContent).toContain("解答");
      expect(row("沒有國小").textContent).not.toContain("解答");
    });

    it("offers the 題目｜解答 switch only when the exam has an answer sheet", () => {
      renderAnswers(open(noAnswer));
      expect(container.querySelector('[aria-label="題目或解答"]')).toBeNull();

      renderAnswers(open(withPdfAnswer));
      expect(button("題目").getAttribute("aria-pressed")).toBe("true");
      expect(button("解答").getAttribute("aria-pressed")).toBe("false");
    });

    it("shows the answer sheet, its download and new-tab links, and puts it in the URL", () => {
      renderAnswers(open(withPdfAnswer));

      act(() => button("解答").click());

      expect(currentParams().get("view")).toBe("answer");
      expect(viewer()?.getAttribute("data-pdf-viewer")).toBe("/exams/pdf/ds/answers/a.pdf");
      const download = container.querySelector<HTMLAnchorElement>("a[download]")!;
      expect(download.getAttribute("href")).toBe("/exams/pdf/ds/answers/a.pdf?download=1");
      expect(download.getAttribute("download")).toBe(`${withPdfAnswer.title}（解答）.pdf`);
      expect(container.querySelector('a[aria-label="在新分頁開啟"]')?.getAttribute("href")).toBe("/exams/pdf/ds/answers/a.pdf");

      act(() => button("題目").click());
      expect(currentParams().get("view")).toBeNull();
      expect(viewer()?.getAttribute("data-pdf-viewer")).toBe(`/exams/${withPdfAnswer.file}`);
    });

    it("asks to download a Word answer sheet", () => {
      renderAnswers(open(withWordAnswer, "answer"));

      expect(viewer()).toBeNull();
      expect(container.textContent).toContain("Word 檔無法在頁面內預覽");
      expect(container.querySelector('a[aria-label="在新分頁開啟"]')).toBeNull();
      expect(container.querySelector("a[download]")?.getAttribute("download")).toBe(`${withWordAnswer.title}（解答）.docx`);
    });

    it("previews a PDF answer sheet for a Word exam", () => {
      renderAnswers(open(wordWithPdfAnswer));
      expect(viewer()).toBeNull();

      act(() => button("解答").click());

      expect(viewer()?.getAttribute("data-pdf-viewer")).toBe("/exams/pdf/ds/answers/c.pdf");
    });

    it("goes back to 題目 when another exam is opened", () => {
      renderAnswers(open(withPdfAnswer, "answer"));

      act(() => row("文化國小").click());

      expect(currentParams().get("view")).toBeNull();
      expect(button("題目").getAttribute("aria-pressed")).toBe("true");
    });

    it("shows the question when the URL asks for an answer the exam does not have", () => {
      renderAnswers(open(noAnswer, "answer"));
      expect(viewer()?.getAttribute("data-pdf-viewer")).toBe(`/exams/${noAnswer.file}`);
    });
  });

  describe("publishers", () => {
    const english = (publisher: string, publisherLabel: string, examCount: number) => ({
      ...MATH_5A,
      id: `english-grade-05-semester-1-${publisher}`,
      subject: "english",
      subjectLabel: "英文",
      publisher,
      publisherLabel,
      examCount,
    });
    const hanlin = english("hanlin", "翰林", 96);
    const kangHsuan = english("kang-hsuan", "康軒", 147);
    const nani = english("nani", "南一", 1);
    const publisherCatalog = makeCatalog(
      [
        minquan,
        makeExam({ datasetId: hanlin.id, school: "翰林國小" }),
        makeExam({ datasetId: kangHsuan.id, school: "康軒國小" }),
        makeExam({ datasetId: nani.id, school: "南一國小" }),
      ],
      [MATH_5A, nani, hanlin, kangHsuan],
    );

    function renderPublishers(path = "/past-exams") {
      setLocation(path);
      followHistory();
      act(() => root.render(<PastExamsPage catalog={publisherCatalog} />));
    }

    function publisherButtons(): string[] {
      const group = container.querySelector('[role="group"][aria-label="版本"]');
      return [...(group?.querySelectorAll("button") ?? [])].map((item) => item.textContent ?? "");
    }

    it("hides the publisher row when the subject has a single publisher", () => {
      renderPublishers();
      expect(container.querySelector('[aria-label="版本"]')).toBeNull();
    });

    it("opens the English publisher with the most exams, and lists publishers by exam count", () => {
      renderPublishers();

      act(() => button("英文").click());

      expect(currentParams().get("c")).toBe(kangHsuan.id);
      expect(listedSchools()).toEqual(["康軒國小"]);
      expect(publisherButtons()).toEqual(["康軒 147", "翰林 96", "南一 1"]);
      expect(button("康軒（147 份）").getAttribute("aria-pressed")).toBe("true");
    });

    it("switches to the publisher that is clicked", () => {
      renderPublishers(`/past-exams?c=${kangHsuan.id}`);

      act(() => button("南一（1 份）").click());

      expect(currentParams().get("c")).toBe(nani.id);
      expect(listedSchools()).toEqual(["南一國小"]);
      expect(button("南一（1 份）").getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("shows the empty state with npm run catalog instruction when no exams are available", () => {
    setLocation("/past-exams");
    followHistory();
    act(() => root.render(<PastExamsPage catalog={makeCatalog([], [])} />));

    expect(container.textContent).toContain("npm run catalog");
    expect(container.textContent).not.toContain("sync:exams");
  });
});
