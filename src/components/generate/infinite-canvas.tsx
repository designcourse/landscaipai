"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import type { CanvasViewport } from "@/hooks/use-canvas-viewport";
import type { CanvasItem } from "./canvas-image-card";
import type { ItemPosition } from "@/hooks/use-canvas-positions";

interface InfiniteCanvasProps {
  viewport: CanvasViewport;
  setViewport: (
    update: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)
  ) => void;
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
  // Shared ref that signals a two-finger pinch is in progress. The canvas sets
  // this so image cards can short-circuit their own drag math while pinch is
  // active (otherwise pinch on top of a card would fight with card drag).
  pinchActiveRef: React.RefObject<boolean>;
  children: ReactNode;
}

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function InfiniteCanvas({
  viewport,
  setViewport,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isSpaceDown,
  onCanvasClick,
  positions,
  canvasItems,
  onMarqueeSelect,
  pinchActiveRef,
  children,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const isMarqueeActive = useRef(false);

  // Touch gesture state — only used when pointerType === "touch".
  // Tracks per-pointer screen position so we can implement single-finger pan
  // and two-finger pinch zoom without depending on the desktop space-key path.
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchPanRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    startCenterCanvasX: number;
    startCenterCanvasY: number;
  } | null>(null);

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

  function isOnBackground(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el === containerRef.current || el.dataset?.canvasBg === "true";
  }

  function handlePointerDownLocal(e: React.PointerEvent) {
    // ----- Touch gesture path (mobile / tablet) -----
    if (e.pointerType === "touch") {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const touchCount = activeTouchesRef.current.size;

      if (touchCount === 1 && isOnBackground(e.target)) {
        touchPanRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          moved: false,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
        return;
      }

      if (touchCount === 2) {
        // Promote to pinch: cancel any single-touch pan and any marquee in progress
        touchPanRef.current = null;
        isMarqueeActive.current = false;
        setMarquee(null);

        const points = Array.from(activeTouchesRef.current.values());
        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        const dist = Math.hypot(dx, dy) || 1;
        const centerScreenX = (points[0].x + points[1].x) / 2;
        const centerScreenY = (points[0].y + points[1].y) / 2;
        const center = screenToCanvas(centerScreenX, centerScreenY);

        pinchRef.current = {
          startDist: dist,
          startZoom: viewport.zoom,
          startPanX: viewport.panX,
          startPanY: viewport.panY,
          startCenterCanvasX: center.x,
          startCenterCanvasY: center.y,
        };
        e.preventDefault();
        return;
      }

      // 3+ touches — ignore
      return;
    }

    // ----- Mouse / pen path (desktop) -----
    if (isSpaceDown.current) {
      onPointerDown(e);
      return;
    }

    if (isOnBackground(e.target)) {
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
    // ----- Touch gesture path -----
    if (e.pointerType === "touch") {
      if (!activeTouchesRef.current.has(e.pointerId)) return;
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Pinch
      if (pinchRef.current && activeTouchesRef.current.size >= 2) {
        const points = Array.from(activeTouchesRef.current.values()).slice(0, 2);
        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        const dist = Math.hypot(dx, dy) || 1;

        const centerScreenX = (points[0].x + points[1].x) / 2;
        const centerScreenY = (points[0].y + points[1].y) / 2;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const screenX = centerScreenX - rect.left;
        const screenY = centerScreenY - rect.top;

        const scale = dist / pinchRef.current.startDist;
        const newZoom = clamp(
          pinchRef.current.startZoom * scale,
          MIN_ZOOM,
          MAX_ZOOM
        );

        // Keep the original pinch-center canvas point under the live screen
        // center of the two fingers as they move.
        const newPanX = screenX / newZoom - pinchRef.current.startCenterCanvasX;
        const newPanY = screenY / newZoom - pinchRef.current.startCenterCanvasY;

        setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
        return;
      }

      // Single-finger pan
      if (touchPanRef.current) {
        const dx = e.clientX - touchPanRef.current.lastX;
        const dy = e.clientY - touchPanRef.current.lastY;
        touchPanRef.current.lastX = e.clientX;
        touchPanRef.current.lastY = e.clientY;
        if (
          !touchPanRef.current.moved &&
          (Math.abs(e.clientX - touchPanRef.current.startX) > 4 ||
            Math.abs(e.clientY - touchPanRef.current.startY) > 4)
        ) {
          touchPanRef.current.moved = true;
        }
        setViewport((prev) => ({
          ...prev,
          panX: prev.panX + dx / prev.zoom,
          panY: prev.panY + dy / prev.zoom,
        }));
      }
      return;
    }

    // ----- Mouse / pen path -----
    if (isMarqueeActive.current && marquee) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setMarquee((prev) =>
        prev ? { ...prev, currentX: canvasPos.x, currentY: canvasPos.y } : null
      );
      return;
    }
    onPointerMove(e);
  }

  function handlePointerUpLocal(e: React.PointerEvent) {
    // ----- Touch gesture path -----
    if (e.pointerType === "touch") {
      activeTouchesRef.current.delete(e.pointerId);
      const remaining = activeTouchesRef.current.size;

      // End pinch when fewer than 2 fingers remain
      if (pinchRef.current && remaining < 2) {
        pinchRef.current = null;
        // If 1 touch remains, start a fresh pan from there to avoid jumps
        if (remaining === 1) {
          const last = Array.from(activeTouchesRef.current.values())[0];
          touchPanRef.current = {
            startX: last.x,
            startY: last.y,
            lastX: last.x,
            lastY: last.y,
            moved: true,
          };
        }
        return;
      }

      // End single-finger pan: tap-without-movement on background = deselect
      if (touchPanRef.current && remaining === 0) {
        const wasTap = !touchPanRef.current.moved;
        touchPanRef.current = null;
        if (wasTap) onCanvasClick();
      }
      return;
    }

    // ----- Mouse / pen path -----
    if (isMarqueeActive.current && marquee) {
      isMarqueeActive.current = false;

      const mx = Math.min(marquee.startX, marquee.currentX);
      const my = Math.min(marquee.startY, marquee.currentY);
      const mw = Math.abs(marquee.currentX - marquee.startX);
      const mh = Math.abs(marquee.currentY - marquee.startY);

      if (mw < 5 && mh < 5) {
        onCanvasClick();
        setMarquee(null);
        return;
      }

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

  function handlePointerCancelLocal(e: React.PointerEvent) {
    if (e.pointerType === "touch") {
      activeTouchesRef.current.delete(e.pointerId);
      if (activeTouchesRef.current.size < 2) {
        pinchRef.current = null;
        pinchActiveRef.current = false;
      }
      if (activeTouchesRef.current.size === 0) touchPanRef.current = null;
    }
  }

  // ---- Capture-phase touch tracking ----
  // Image cards stopPropagation on their own pointerdown to handle drag without
  // also panning. That means the bubble-phase canvas handler never sees the
  // touch, so when a user puts their second finger down on a card we'd miss
  // the pinch-promotion entirely. Capture phase runs BEFORE children, so we
  // can record every touch regardless of where it landed and run the pinch
  // math from here. `pinchActiveRef` then tells the cards to stop dragging
  // for the duration of the gesture.
  function handlePointerDownCaptureLocal(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouchesRef.current.size === 2) {
      touchPanRef.current = null;
      isMarqueeActive.current = false;
      setMarquee(null);

      const points = Array.from(activeTouchesRef.current.values());
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const centerScreenX = (points[0].x + points[1].x) / 2;
      const centerScreenY = (points[0].y + points[1].y) / 2;
      const center = screenToCanvas(centerScreenX, centerScreenY);

      pinchRef.current = {
        startDist: dist,
        startZoom: viewport.zoom,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
        startCenterCanvasX: center.x,
        startCenterCanvasY: center.y,
      };
      pinchActiveRef.current = true;
    }
  }

  function handlePointerMoveCaptureLocal(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    if (!activeTouchesRef.current.has(e.pointerId)) return;
    activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchRef.current && activeTouchesRef.current.size >= 2) {
      const points = Array.from(activeTouchesRef.current.values()).slice(0, 2);
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const dist = Math.hypot(dx, dy) || 1;

      const centerScreenX = (points[0].x + points[1].x) / 2;
      const centerScreenY = (points[0].y + points[1].y) / 2;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const screenX = centerScreenX - rect.left;
      const screenY = centerScreenY - rect.top;

      const scale = dist / pinchRef.current.startDist;
      const newZoom = clamp(
        pinchRef.current.startZoom * scale,
        MIN_ZOOM,
        MAX_ZOOM
      );
      const newPanX = screenX / newZoom - pinchRef.current.startCenterCanvasX;
      const newPanY = screenY / newZoom - pinchRef.current.startCenterCanvasY;
      setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
    }
  }

  function handlePointerUpCaptureLocal(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    activeTouchesRef.current.delete(e.pointerId);
    if (activeTouchesRef.current.size < 2 && pinchRef.current) {
      pinchRef.current = null;
      pinchActiveRef.current = false;
    }
  }

  // Compute marquee display rect (in screen/CSS pixels, positioned over the canvas)
  let marqueeStyle: React.CSSProperties | null = null;
  if (marquee) {
    const mx = Math.min(marquee.startX, marquee.currentX);
    const my = Math.min(marquee.startY, marquee.currentY);
    const mw = Math.abs(marquee.currentX - marquee.startX);
    const mh = Math.abs(marquee.currentY - marquee.startY);

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
        // Disable native pan/zoom so the canvas can manage its own gestures.
        touchAction: "none",
      }}
      onPointerDown={handlePointerDownLocal}
      onPointerMove={handlePointerMoveLocal}
      onPointerUp={handlePointerUpLocal}
      onPointerCancel={handlePointerCancelLocal}
      onPointerDownCapture={handlePointerDownCaptureLocal}
      onPointerMoveCapture={handlePointerMoveCaptureLocal}
      onPointerUpCapture={handlePointerUpCaptureLocal}
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
