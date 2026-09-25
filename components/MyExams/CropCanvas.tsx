"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
}

type Drag =
  | { type: "draw"; pointerId: number; start: Point; current: Point }
  | { type: "move"; pointerId: number; key: string; origin: Box; start: Point; current: Point }
  | { type: "resize"; pointerId: number; key: string; corner: Corner; origin: Box; start: Point; current: Point };

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

const CORNER_CLASS: Record<Corner, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  ne: "left-full top-0 cursor-nesw-resize",
  sw: "left-0 top-full cursor-nesw-resize",
  se: "left-full top-full cursor-nwse-resize",
};

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
    onSelect(null);
    const point = pointFrom(event);
    setDrag({ type: "draw", pointerId: event.pointerId, start: point, current: point });
  };

  const startMove = (item: CanvasBox) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (rejectExtraPointer(event)) return;
    capturePointer(event);
    onSelect(item.key);
    const point = pointFrom(event);
    setDrag({
      type: "move",
      pointerId: event.pointerId,
      key: item.key,
      origin: item.box,
      start: point,
      current: point,
    });
  };

  const startResize =
    (item: CanvasBox, corner: Corner) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      if (rejectExtraPointer(event)) return;
      capturePointer(event);
      const point = pointFrom(event);
      setDrag({
        type: "resize",
        pointerId: event.pointerId,
        key: item.key,
        corner,
        origin: item.box,
        start: point,
        current: point,
      });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!liveDrag || event.pointerId !== liveDrag.pointerId) return;
    setDrag({ ...liveDrag, current: pointFrom(event) });
  };

  const handleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!liveDrag) return;
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

  const drawPreview = liveDrag?.type === "draw" ? dragResult(liveDrag) : null;

  return (
    <div className="relative select-none">
      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt} draggable={false} className="block h-auto w-full" />
      ) : (
        <div className="aspect-[3/4] w-full animate-pulse bg-base-200" />
      )}
      <div
        ref={overlayRef}
        data-testid="crop-overlay"
        className={`absolute inset-0 touch-none ${mode === "question" ? "cursor-crosshair" : "cursor-cell"}`}
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
              className={`absolute cursor-move border-2 ${look}${showHandles ? " z-10" : ""}`}
              style={boxStyle(box)}
              onPointerDown={startMove(item)}
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
                    className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${CORNER_CLASS[corner]}`}
                    onPointerDown={startResize(item, corner)}
                  >
                    <span className="size-3 rounded-sm border-2 border-primary bg-white" />
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
