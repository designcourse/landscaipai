"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import type { CanvasViewport } from "@/hooks/use-canvas-viewport";
import type { CanvasItem } from "./canvas-image-card";
import type { ItemPosition } from "@/hooks/use-canvas-positions";

interface InfiniteCanvasProps {
  viewport: CanvasViewport;
  onWheel: (e: WheelEvent, containerRect: DOMRect) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  isSpaceDown: React.RefObject<boolean>;
  onCanvasClick: () => void;
  // Marquee selection
  positions: Record<string, ItemPosition>;
  canvasItems: CanvasItem[];
  onMarqueeSelect: (ids: string[]) => void;
  children: ReactNode;
}

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function InfiniteCanvas({
  viewport,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isSpaceDown,
  onCanvasClick,
  positions,
  canvasItems,
  onMarqueeSelect,
  children,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const isMarqueeActive = useRef(false);

  // Attach non-passive wheel listener for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheelEvent(e: WheelEvent) {
      const rect = container!.getBoundingClientRect();
      onWheel(e, rect);
    }

    container.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelEvent);
  }, [onWheel]);

  // Screen coords to canvas coords
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      return {
        x: (screenX - rect.left) / viewport.zoom - viewport.panX,
        y: (screenY - rect.top) / viewport.zoom - viewport.panY,
      };
    },
    [viewport]
  );

  function handlePointerDownLocal(e: React.PointerEvent) {
    // If space is held, delegate to pan handler
    if (isSpaceDown.current) {
      onPointerDown(e);
      return;
    }

    // Only start marquee if clicking directly on canvas background (not on a card)
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.dataset.canvasBg) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      isMarqueeActive.current = true;
      setMarquee({
        startX: canvasPos.x,
        startY: canvasPos.y,
        currentX: canvasPos.x,
        currentY: canvasPos.y,
      });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
  }

  function handlePointerMoveLocal(e: React.PointerEvent) {
    if (isMarqueeActive.current && marquee) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setMarquee((prev) =>
        prev ? { ...prev, currentX: canvasPos.x, currentY: canvasPos.y } : null
      );
      return;
    }
    // Delegate to pan handler
    onPointerMove(e);
  }

  function handlePointerUpLocal(e: React.PointerEvent) {
    if (isMarqueeActive.current && marquee) {
      isMarqueeActive.current = false;

      // Compute the marquee bounding box in canvas space
      const mx = Math.min(marquee.startX, marquee.currentX);
      const my = Math.min(marquee.startY, marquee.currentY);
      const mw = Math.abs(marquee.currentX - marquee.startX);
      const mh = Math.abs(marquee.currentY - marquee.startY);

      // If the marquee is too small (just a click), treat as deselect
      if (mw < 5 && mh < 5) {
        onCanvasClick();
        setMarquee(null);
        return;
      }

      // Find all canvas items that intersect the marquee rect
      const hitIds: string[] = [];
      for (const item of canvasItems) {
        const pos = positions[item.id];
        if (!pos) continue;
        if (rectsIntersect(mx, my, mw, mh, pos.x, pos.y, pos.width, pos.height)) {
          hitIds.push(item.id);
        }
      }

      onMarqueeSelect(hitIds);
      setMarquee(null);
      return;
    }
    onPointerUp(e);
  }

  // Compute marquee display rect (in screen/CSS pixels, positioned over the canvas)
  let marqueeStyle: React.CSSProperties | null = null;
  if (marquee) {
    const mx = Math.min(marquee.startX, marquee.currentX);
    const my = Math.min(marquee.startY, marquee.currentY);
    const mw = Math.abs(marquee.currentX - marquee.startX);
    const mh = Math.abs(marquee.currentY - marquee.startY);

    // Convert canvas coords to screen position (accounting for zoom/pan)
    marqueeStyle = {
      position: "absolute",
      left: (mx + viewport.panX) * viewport.zoom,
      top: (my + viewport.panY) * viewport.zoom,
      width: mw * viewport.zoom,
      height: mh * viewport.zoom,
      border: "1px solid rgba(59, 130, 246, 0.8)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      pointerEvents: "none",
      zIndex: 50,
    };
  }

  const cursorStyle = isSpaceDown.current ? "grab" : "default";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        cursor: cursorStyle,
        backgroundColor: "var(--color-canvas-bg)",
        backgroundImage: "url(/assets/main-control-bg.png)",
        backgroundRepeat: "repeat",
        backgroundSize: "15px 15px",
      }}
      onPointerDown={handlePointerDownLocal}
      onPointerMove={handlePointerMoveLocal}
      onPointerUp={handlePointerUpLocal}
      data-canvas-bg="true"
    >
      <div
        style={{
          transform: `scale(${viewport.zoom}) translate(${viewport.panX}px, ${viewport.panY}px)`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
        data-canvas-bg="true"
      >
        {children}
      </div>

      {/* Marquee selection rectangle */}
      {marqueeStyle && <div style={marqueeStyle} />}
    </div>
  );
}
