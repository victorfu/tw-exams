"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Box } from "../../types/questionBank";
import {
  boxFromPoints,
  isBoxTooSmall,
  moveBox,
  resizeBoxBy,
  sameBox,
  toRelativePoint,
  type Corner,
  type Point,
} from "./boxGeometry";

export interface CanvasBox {
  key: string;
  box: Box;
  label?: string;
  /** 螢幕閱讀器念的名稱（「第 1 題」「第 1 題（續）」「遮蓋 1」）；沒給時用 label。 */
  name?: string;
}

/**
 * 拖拉的共同欄位。startClient 是按下時的螢幕座標（CSS px）；指標離它超過 slop 之前
 * current 不跟著動，點一下（手指難免晃幾 px）只會選取，不會移動或縮放後自動儲存。
 */
interface DragBase {
  pointerId: number;
  start: Point;
  current: Point;
  startClient: { x: number; y: number };
  slop: number;
  moved: boolean;
}

type Drag =
  | ({ type: "draw" } & DragBase)
  | ({ type: "move"; key: string; origin: Box } & DragBase)
  | ({ type: "resize"; key: string; corner: Corner; origin: Box } & DragBase);

/** 點一下的容許晃動（CSS px）：滑鼠很準，手指／觸控筆放寬一些。 */
const MOUSE_TAP_SLOP_PX = 3;
const TOUCH_TAP_SLOP_PX = 8;

interface CropCanvasProps {
  imageUrl: string | undefined;
  imageAlt: string;
  mode: "question" | "mask";
  questionBoxes: readonly CanvasBox[];
  maskBoxes: readonly CanvasBox[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onCreate: (box: Box) => void;
  onChange: (key: string, box: Box) => void;
}

const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

// 水平位置用 --handle-inset（見 handleInsetStyle），垂直照舊置中在角上。
const CORNER_CLASS: Record<Corner, string> = {
  nw: "left-(--handle-inset) top-0 cursor-nwse-resize",
  ne: "right-(--handle-inset) top-0 cursor-nesw-resize",
  sw: "left-(--handle-inset) top-full cursor-nesw-resize",
  se: "right-(--handle-inset) top-full cursor-nwse-resize",
};

const DOT_CLASS: Record<Corner, string> = {
  nw: "left-(--dot-inset)",
  ne: "right-(--dot-inset)",
  sw: "left-(--dot-inset)",
  se: "right-(--dot-inset)",
};

/** 把手點擊範圍（size-11 = 44px）與看得到的小方塊（size-3 = 12px）的一半。 */
const HANDLE_HALF_PX = 22;
const DOT_HALF_PX = 6;

/**
 * 角落把手的水平位置。有空間時置中在角上（凸出框外一半）；框貼近圖片左右邊時往內收，
 * 最多凸出到圖片邊緣為止，才不會被外層的 overflow-x-clip 切掉、按不到。
 * room 是框外到圖片邊緣的距離（頁寬比例），100cqw 是圖片寬度（overlay 是 @container）。
 * --handle-inset 是點擊範圍相對框邊的 left／right；--dot-inset 是小方塊在點擊範圍裡的位置。
 */
function handleInsetStyle(box: Box, corner: Corner): CSSProperties {
  const room = corner === "nw" || corner === "sw" ? box.x : 1 - box.x - box.w;
  const limit = `-${Math.max(0, room) * 100}cqw`;
  const hit = `max(-${HANDLE_HALF_PX}px, ${limit})`;
  return {
    "--handle-inset": hit,
    "--dot-inset": `calc(max(-${DOT_HALF_PX}px, ${limit}) - ${hit})`,
  } as CSSProperties;
}

function dragResult(drag: Drag): Box {
  switch (drag.type) {
    case "draw":
      return boxFromPoints(drag.start, drag.current);
    case "move":
      return moveBox(drag.origin, drag.current.x - drag.start.x, drag.current.y - drag.start.y);
    case "resize":
      return resizeBoxBy(drag.origin, drag.corner, drag.current.x - drag.start.x, drag.current.y - drag.start.y);
  }
}

/**
 * 拖拉的框還在、而且還是按下時那個框。拖拉途中用鍵盤刪掉它，或刪掉前面的框讓
 * 別的框遞補到同一個 key 時，這次拖拉就作廢，放開時才不會改到已刪除的題目或別的框。
 */
function isDragTargetCurrent(drag: Drag, boxes: readonly CanvasBox[]): boolean {
  if (drag.type === "draw") return true;
  const target = boxes.find((item) => item.key === drag.key);
  return target !== undefined && sameBox(target.box, drag.origin);
}

function boxStyle(box: Box) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

function capturePointer(event: ReactPointerEvent<HTMLElement>): void {
  if (event.pointerId === undefined) return;
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // 不支援 pointer capture 的環境（如 jsdom）直接略過
  }
}

/**
 * 頁面大圖上的框。框用絕對定位的 HTML div（百分比位置、px 把手），
 * 不用非等比縮放的 SVG，線條與把手才不會變形（spec §8.2）。
 */
export function CropCanvas({
  imageUrl,
  imageAlt,
  mode,
  questionBoxes,
  maskBoxes,
  selectedKey,
  onSelect,
  onCreate,
  onChange,
}: CropCanvasProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const activeBoxes = mode === "question" ? questionBoxes : maskBoxes;
  const passiveBoxes = mode === "question" ? maskBoxes : questionBoxes;
  // 作廢的拖拉留在 state 裡也不作用：不畫、不回報，等它的指標放開或下一次按下時清掉。
  const liveDrag = drag && isDragTargetCurrent(drag, activeBoxes) ? drag : null;

  const pointFrom = (event: ReactPointerEvent): Point => {
    const rect = overlayRef.current?.getBoundingClientRect();
    return rect ? toRelativePoint(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
  };

  const dragBase = (event: ReactPointerEvent): DragBase => {
    const point = pointFrom(event);
    return {
      pointerId: event.pointerId,
      start: point,
      current: point,
      startClient: { x: event.clientX, y: event.clientY },
      slop: event.pointerType === "mouse" ? MOUSE_TAP_SLOP_PX : TOUCH_TAP_SLOP_PX,
      moved: false,
    };
  };

  /**
   * 同時只跟一個指標：拖拉途中另一個指標按下（第二根手指捏合縮放、手掌）時，
   * 取消這次拖拉，也不開始新的，免得用兩個指標混在一起的座標建框或移框。
   */
  const rejectExtraPointer = (event: ReactPointerEvent): boolean => {
    if (!liveDrag || liveDrag.pointerId === event.pointerId) return false;
    setDrag(null);
    return true;
  };

  const startDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (rejectExtraPointer(event)) return;
    capturePointer(event);
    // 取消選取等到放開才做：觸控上下滑動會變成捲動頁面（pointercancel），
    // 選取要留著，使用者才能捲去按工具列的「刪除」。
    setDrag({ type: "draw", ...dragBase(event) });
  };

  const startMove = (item: CanvasBox) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (rejectExtraPointer(event)) return;
    capturePointer(event);
    onSelect(item.key);
    setDrag({ type: "move", key: item.key, origin: item.box, ...dragBase(event) });
  };

  const startResize =
    (item: CanvasBox, corner: Corner) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      if (rejectExtraPointer(event)) return;
      capturePointer(event);
      setDrag({ type: "resize", key: item.key, corner, origin: item.box, ...dragBase(event) });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!liveDrag || event.pointerId !== liveDrag.pointerId) return;
    const moved =
      liveDrag.moved ||
      Math.hypot(event.clientX - liveDrag.startClient.x, event.clientY - liveDrag.startClient.y) > liveDrag.slop;
    if (!moved) return;
    setDrag({ ...liveDrag, moved, current: pointFrom(event) });
  };

  const handleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!liveDrag) return;
    if (liveDrag.type === "draw") onSelect(null);
    const box = dragResult(liveDrag);
    if (isBoxTooSmall(box)) return;
    if (liveDrag.type === "draw") {
      onCreate(box);
    } else if (!sameBox(box, liveDrag.origin)) {
      onChange(liveDrag.key, box);
    }
  };

  const handleCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag && event.pointerId === drag.pointerId) setDrag(null);
  };

  // 鍵盤：Tab 到框上就選取它，Enter／空白鍵也可以（例如按 Esc 取消選取後再選回來）。
  // 移動、縮放、刪除的按鍵由編輯器在 window 上處理，作用在選取中的框。
  const selectWithKey = (item: CanvasBox) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(item.key);
  };

  const drawPreview = liveDrag?.type === "draw" ? dragResult(liveDrag) : null;

  return (
    // overflow-x-clip：貼右邊的框，角落把手的點擊範圍會凸出圖片外；手機的左右邊距比它窄，
    // 不裁掉的話選取時頁面會多出可以左右捲的寬度。只裁水平方向，上下不受影響。
    // 貼邊的把手會往內收（handleInsetStyle），不會被裁掉一半。
    <div className="relative select-none overflow-x-clip">
      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt} draggable={false} className="block h-auto w-full" />
      ) : (
        <div className="aspect-[3/4] w-full animate-pulse bg-base-200" />
      )}
      {/* 觸控：頁面圖片在手機／平板上常比螢幕高又佔滿寬度。空白處用 touch-pan-y，上下滑動
          交給瀏覽器捲動（會送 pointercancel，不會建框），橫向起手才開始框選；框和把手設
          touch-none，拖拉移動、縮放不會被捲動搶走。滑鼠不受 touch-action 影響。 */}
      <div
        ref={overlayRef}
        data-testid="crop-overlay"
        className={`@container absolute inset-0 touch-pan-y touch-pinch-zoom ${mode === "question" ? "cursor-crosshair" : "cursor-cell"}`}
        onPointerDown={startDraw}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
      >
        {passiveBoxes.map((item) => (
          <div
            key={item.key}
            className={`pointer-events-none absolute ${
              mode === "question"
                ? "border border-dashed border-warning bg-white/60"
                : "border border-primary/40"
            }`}
            style={boxStyle(item.box)}
          />
        ))}

        {activeBoxes.map((item) => {
          const selected = item.key === selectedKey;
          const dragged = liveDrag !== null && liveDrag.type !== "draw" && liveDrag.key === item.key;
          const box = dragged ? dragResult(liveDrag) : item.box;
          // 縮放中途選取被清掉（Esc）時把手要留著：它握著 pointer capture，
          // 拿掉的話在畫面外放開就收不到 pointerup，拖拉會卡住。
          // 有把手的框疊在後畫的框上面（z-10），它的把手才不會被後面的框蓋住、搶走。
          const showHandles = selected || (dragged && liveDrag.type === "resize");
          const look =
            mode === "question"
              ? selected
                ? "border-primary bg-primary/20"
                : "border-primary/70 bg-primary/10"
              : `border-dashed border-warning ${selected ? "bg-white/90" : "bg-white/70"}`;
          return (
            <div
              key={item.key}
              data-box-key={item.key}
              role="button"
              tabIndex={0}
              aria-label={item.name ?? item.label}
              aria-pressed={selected}
              className={`absolute cursor-move touch-none border-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary ${look}${showHandles ? " z-10" : ""}`}
              style={boxStyle(box)}
              onPointerDown={startMove(item)}
              onFocus={() => onSelect(item.key)}
              onKeyDown={selectWithKey(item)}
            >
              {item.label && (
                <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-primary px-1 text-xs font-semibold text-primary-content">
                  {item.label}
                </span>
              )}
              {showHandles &&
                CORNERS.map((corner) => (
                  <div
                    key={corner}
                    data-corner={corner}
                    className={`absolute size-11 -translate-y-1/2 ${CORNER_CLASS[corner]}`}
                    style={handleInsetStyle(box, corner)}
                    onPointerDown={startResize(item, corner)}
                  >
                    <span
                      className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-sm border-2 border-primary bg-white ${DOT_CLASS[corner]}`}
                    />
                  </div>
                ))}
            </div>
          );
        })}

        {drawPreview && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-primary"
            style={boxStyle(drawPreview)}
          />
        )}
      </div>
    </div>
  );
}
