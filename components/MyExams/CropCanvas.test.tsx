import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CropCanvas } from "./CropCanvas";

let container: HTMLDivElement;
let root: Root;

type Props = ComponentProps<typeof CropCanvas>;

function renderCanvas(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    imageUrl: "https://signed/p0",
    imageAlt: "第 1 頁",
    mode: "question",
    questionBoxes: [],
    maskBoxes: [],
    selectedKey: null,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  act(() => root.render(<CropCanvas {...props} />));
  const overlay = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!overlay) throw new Error("overlay missing");
  overlay.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return props;
}

function pointer(type: string, target: Element, clientX: number, clientY: number, pointerId?: number): void {
  const EventType = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    const init = { bubbles: true, cancelable: true, clientX, clientY, button: 0, pointerId };
    target.dispatchEvent(new EventType(type, init as MouseEventInit));
  });
}

function boxElement(key: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-box-key="${key}"]`);
  if (!element) throw new Error(`box ${key} missing`);
  return element;
}

function cornerHandle(key: string, corner: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-box-key="${key}"] [data-corner="${corner}"]`);
  if (!element) throw new Error(`handle ${key} ${corner} missing`);
  return element;
}

function rerender(props: Props, overrides: Partial<Props>): Props {
  const next = { ...props, ...overrides };
  act(() => root.render(<CropCanvas {...next} />));
  return next;
}

function overlay(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!element) throw new Error("overlay missing");
  return element;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CropCanvas", () => {
  it("creates a normalized box from a drag on empty space", () => {
    const props = renderCanvas();
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointermove", overlay(), 120, 60);
    pointer("pointerup", overlay(), 120, 60);

    expect(props.onSelect).toHaveBeenCalledWith(null);
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    const [box] = (props.onCreate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(box.x).toBeCloseTo(0.1);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.5);
    expect(box.h).toBeCloseTo(0.5);
  });

  it("ignores a tiny accidental drag", () => {
    const props = renderCanvas();
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointerup", overlay(), 21, 10);
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("selects and moves an existing box", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, label: "1" }],
    });
    const boxElement = container.querySelector('[data-box-key="q:a:0"]');
    if (!boxElement) throw new Error("box missing");

    pointer("pointerdown", boxElement, 40, 20);
    pointer("pointermove", overlay(), 60, 30);
    pointer("pointerup", overlay(), 60, 30);

    expect(props.onSelect).toHaveBeenCalledWith("q:a:0");
    expect(props.onCreate).not.toHaveBeenCalled();
    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.2);
    expect(box.y).toBeCloseTo(0.2);
    expect(box.w).toBeCloseTo(0.2);
  });

  it("does not report a change for a click without movement", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    const boxElement = container.querySelector('[data-box-key="q:a:0"]');
    if (!boxElement) throw new Error("box missing");
    pointer("pointerdown", boxElement, 40, 20);
    pointer("pointerup", overlay(), 40, 20);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("resizes the selected box from a corner handle", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    const handle = container.querySelector('[data-box-key="q:a:0"] [data-corner="se"]');
    if (!handle) throw new Error("handle missing");

    pointer("pointerdown", handle, 60, 30);
    pointer("pointermove", overlay(), 100, 80);
    pointer("pointerup", overlay(), 100, 80);

    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.4);
    expect(box.h).toBeCloseTo(0.7);
  });

  it("does not resize when a corner handle is clicked away from its exact corner", () => {
    // 把手的點擊範圍比角大（44px）：按下的位置不在角上，也不能讓角跳過去。
    const props = renderCanvas({
      mode: "mask",
      maskBoxes: [{ key: "m:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "m:0",
    });
    const handle = cornerHandle("m:0", "se"); // 角在 (60,30)

    pointer("pointerdown", handle, 50, 25);
    pointer("pointerup", overlay(), 50, 25);

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("moves the corner by the pointer's movement, keeping the grab offset", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    const handle = cornerHandle("q:a:0", "se"); // 角在 (60,30)

    pointer("pointerdown", handle, 50, 25);
    pointer("pointermove", overlay(), 70, 35);
    pointer("pointerup", overlay(), 70, 35);

    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.1);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.3); // 角 60 → 80
    expect(box.h).toBeCloseTo(0.3); // 角 30 → 40
  });

  it("raises the selected box above the boxes drawn after it", () => {
    renderCanvas({
      questionBoxes: [
        { key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
        { key: "q:b:0", box: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } },
      ],
      selectedKey: "q:a:0",
    });
    expect(boxElement("q:a:0").className).toContain("z-10");
    expect(boxElement("q:b:0").className).not.toContain("z-10");
  });

  it("cancels a move when a second finger touches down, and ignores that finger", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } }],
    });

    pointer("pointerdown", boxElement("q:a:0"), 40, 20, 1);
    pointer("pointerdown", overlay(), 150, 80, 2);
    pointer("pointermove", overlay(), 20, 10, 1);
    pointer("pointermove", overlay(), 190, 95, 2);
    pointer("pointerup", overlay(), 20, 10, 1);
    pointer("pointerup", overlay(), 190, 95, 2);

    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith("q:a:0");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("does not draw a box from a two-finger pinch that starts on empty space", () => {
    const props = renderCanvas();

    pointer("pointerdown", overlay(), 90, 50, 1);
    pointer("pointerdown", overlay(), 110, 50, 2);
    pointer("pointermove", overlay(), 150, 70, 2);
    pointer("pointermove", overlay(), 40, 20, 1);
    pointer("pointerup", overlay(), 40, 20, 1);
    pointer("pointerup", overlay(), 150, 70, 2);

    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("ignores moves, releases and cancels from other pointers during a drag", () => {
    const props = renderCanvas();

    pointer("pointerdown", overlay(), 20, 10, 1);
    pointer("pointermove", overlay(), 180, 90, 7); // 懸停的觸控筆
    pointer("pointerup", overlay(), 180, 90, 7);
    act(() => {
      overlay().dispatchEvent(new window.PointerEvent("pointercancel", { bubbles: true, pointerId: 9 }));
    });
    pointer("pointermove", overlay(), 120, 60, 1);
    pointer("pointerup", overlay(), 120, 60, 1);

    expect(props.onCreate).toHaveBeenCalledTimes(1);
    const [box] = (props.onCreate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(box.x).toBeCloseTo(0.1);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.5);
    expect(box.h).toBeCloseTo(0.5);
  });

  it("drops a move whose box was deleted before the pointer was released", () => {
    let props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });

    pointer("pointerdown", boxElement("q:a:0"), 40, 20);
    pointer("pointermove", overlay(), 60, 30);
    props = rerender(props, { questionBoxes: [], selectedKey: null }); // 按 Delete 刪掉
    pointer("pointermove", overlay(), 80, 40);
    pointer("pointerup", overlay(), 80, 40);

    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("drops a move whose mask index was taken over by the next mask", () => {
    const maskB = { x: 0.6, y: 0.6, w: 0.2, h: 0.2 };
    let props = renderCanvas({
      mode: "mask",
      maskBoxes: [
        { key: "m:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
        { key: "m:1", box: maskB },
      ],
    });

    pointer("pointerdown", boxElement("m:0"), 30, 20);
    pointer("pointermove", overlay(), 40, 30);
    // 刪掉 m:0 後，原本的 m:1 遞補成 m:0
    props = rerender(props, { maskBoxes: [{ key: "m:0", box: maskB }], selectedKey: null });

    // 遞補上來的遮蓋框留在原位，不會被畫成拖拉中的框
    expect(boxElement("m:0").style.left).toBe("60%");
    expect(boxElement("m:0").style.top).toBe("60%");

    pointer("pointermove", overlay(), 50, 40);
    pointer("pointerup", overlay(), 50, 40);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("keeps a corner resize going when the selection is cleared mid-drag", () => {
    // Esc 會清掉選取；抓著指標的把手不能跟著消失，否則放開事件可能收不到。
    let props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });

    pointer("pointerdown", cornerHandle("q:a:0", "se"), 60, 30);
    pointer("pointermove", overlay(), 80, 40);
    props = rerender(props, { selectedKey: null });
    const handle = cornerHandle("q:a:0", "se");
    pointer("pointermove", handle, 100, 50);
    pointer("pointerup", handle, 100, 50);

    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.w).toBeCloseTo(0.4);
    expect(box.h).toBeCloseTo(0.4);
  });

  it("does not move a box that is tapped with a little finger jitter", () => {
    // 點框選取時手指的微小晃動不能當成移動存下來（#48）。
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    pointer("pointerdown", boxElement("q:a:0"), 40, 20);
    pointer("pointermove", overlay(), 42, 23);
    pointer("pointerup", overlay(), 42, 23);

    expect(props.onSelect).toHaveBeenCalledWith("q:a:0");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("does not resize a box when its corner is tapped with a little finger jitter", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    pointer("pointerdown", cornerHandle("q:a:0", "se"), 60, 30);
    pointer("pointermove", overlay(), 63, 32);
    pointer("pointerup", overlay(), 63, 32);

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("keeps the whole movement once the drag passes the tap slop", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    pointer("pointerdown", boxElement("q:a:0"), 40, 20);
    pointer("pointermove", overlay(), 43, 20);
    pointer("pointermove", overlay(), 60, 20);
    pointer("pointermove", overlay(), 42, 20); // 過了門檻後，拉回起點附近也照算
    pointer("pointerup", overlay(), 42, 20);

    const [, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(box.x).toBeCloseTo(0.11);
  });

  it("keeps the selection when a touch on empty space turns into a page scroll", () => {
    // 觸控上下滑動會交給瀏覽器捲動（pointercancel）：選取要留著，才能捲去按「刪除」。
    const props = renderCanvas({ selectedKey: "q:a:0" });
    pointer("pointerdown", overlay(), 20, 10);
    act(() => {
      overlay().dispatchEvent(new window.PointerEvent("pointercancel", { bubbles: true }));
    });
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("clears the selection when empty space is tapped", () => {
    const props = renderCanvas({ selectedKey: "q:a:0" });
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointerup", overlay(), 20, 10);
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it("lets touch pan the page vertically from empty space, but not from the boxes", () => {
    // 觸控：空白處可以上下捲動（橫向起手才開始框選），框和把手仍然只給拖拉用（#46）。
    renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    expect(overlay().className).toContain("touch-pan-y");
    expect(overlay().className).not.toContain("touch-none");
    expect(boxElement("q:a:0").className).toContain("touch-none");
  });

  it("clips the corner handles horizontally so they cannot widen the page", () => {
    // 貼右邊的框，把手點擊範圍會凸出圖片外，手機的邊距不夠時頁面會可以左右捲（#47）。
    renderCanvas();
    const root = overlay().parentElement;
    expect(root?.className).toContain("overflow-x-clip");
  });

  it("keeps the corner handles of a box touching the page edges inside the clip area", () => {
    // 畫框會夾到 0／1：貼邊的框，把手置中在角上會被 overflow-x-clip 切掉一半，
    // 要往內收，看得到也按得到。
    renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0, y: 0.1, w: 1, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    expect(overlay().className).toContain("@container");
    for (const corner of ["nw", "sw"]) {
      const handle = cornerHandle("q:a:0", corner);
      expect(handle.className).toContain("left-(--handle-inset)");
      expect(handle.className).not.toContain("-translate-x-1/2");
      expect(handle.style.getPropertyValue("--handle-inset")).toBe("max(-22px, -0cqw)");
    }
    for (const corner of ["ne", "se"]) {
      const handle = cornerHandle("q:a:0", corner);
      expect(handle.className).toContain("right-(--handle-inset)");
      expect(handle.style.getPropertyValue("--handle-inset")).toBe("max(-22px, -0cqw)");
    }
  });

  it("centres the handles on the corners when there is room beside the box", () => {
    renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.25, y: 0.1, w: 0.5, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    expect(cornerHandle("q:a:0", "nw").style.getPropertyValue("--handle-inset")).toBe("max(-22px, -25cqw)");
    expect(cornerHandle("q:a:0", "se").style.getPropertyValue("--handle-inset")).toBe("max(-22px, -25cqw)");
    // 看得到的小方塊也一樣：有空間時置中在角上（-6px），貼邊時收進框內。
    expect(cornerHandle("q:a:0", "nw").style.getPropertyValue("--dot-inset")).toBe(
      "calc(max(-6px, -25cqw) - max(-22px, -25cqw))",
    );
  });

  it("makes the current mode's boxes focusable buttons with a name and pressed state", () => {
    renderCanvas({
      questionBoxes: [
        { key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, label: "1", name: "第 1 題" },
        { key: "q:a:1", box: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, label: "1（續）", name: "第 1 題（續）" },
      ],
      maskBoxes: [{ key: "m:0", box: { x: 0.1, y: 0.6, w: 0.2, h: 0.2 }, name: "遮蓋 1" }],
      selectedKey: "q:a:1",
    });
    const first = boxElement("q:a:0");
    expect(first.tabIndex).toBe(0);
    expect(first.getAttribute("role")).toBe("button");
    expect(first.getAttribute("aria-label")).toBe("第 1 題");
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(boxElement("q:a:1").getAttribute("aria-label")).toBe("第 1 題（續）");
    expect(boxElement("q:a:1").getAttribute("aria-pressed")).toBe("true");
    // 另一個模式的框是被動的，不在 Tab 順序裡
    expect(container.querySelector('[data-box-key="m:0"]')).toBeNull();
  });

  it("selects a box when it receives keyboard focus", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, name: "第 1 題" }],
    });
    act(() => boxElement("q:a:0").focus());
    expect(props.onSelect).toHaveBeenCalledWith("q:a:0");
  });

  it.each(["Enter", " "])("selects the focused box with %j", (key) => {
    const props = renderCanvas({
      mode: "mask",
      maskBoxes: [{ key: "m:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, name: "遮蓋 1" }],
    });
    const box = boxElement("m:0");
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    act(() => {
      box.dispatchEvent(event);
    });
    expect(props.onSelect).toHaveBeenCalledWith("m:0");
    expect(event.defaultPrevented).toBe(true); // 空白鍵不捲動頁面
  });

  it("only lets the current mode's boxes be grabbed", () => {
    const props = renderCanvas({
      mode: "mask",
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    expect(container.querySelector('[data-box-key="q:a:0"]')).toBeNull();
    pointer("pointerdown", overlay(), 40, 20);
    pointer("pointermove", overlay(), 80, 60);
    pointer("pointerup", overlay(), 80, 60);
    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });
});
