"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const VIEWPORT_SAVE_DEBOUNCE_MS = 500;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export function useCanvasViewport(projectId?: string, initial?: Partial<CanvasViewport>) {
  const storageKey = projectId ? `canvas-viewport-${projectId}` : null;

  // Start with defaults — hydrate from localStorage in useEffect to avoid SSR mismatch
  const [viewport, setViewportRaw] = useState<CanvasViewport>({
    zoom: initial?.zoom ?? 1,
    panX: initial?.panX ?? 0,
    panY: initial?.panY ?? 0,
  });

  // Hydrate from localStorage on mount (client-only)
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (hasHydrated.current || !storageKey) return;
    hasHydrated.current = true;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.zoom != null) setViewportRaw(parsed as CanvasViewport);
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Debounced persist of viewport to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const setViewport = useCallback(
    (update: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => {
      setViewportRaw((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        if (storageKey) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
          }, VIEWPORT_SAVE_DEBOUNCE_MS);
        }
        return next;
      });
    },
    [storageKey]
  );

  const isPanningRef = useRef(false);
  const isSpaceDownRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  // Zoom toward a focal point (screen coordinates relative to canvas container)
  const zoomToPoint = useCallback(
    (newZoom: number, focalScreenX: number, focalScreenY: number) => {
      setViewport((prev) => {
        const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
        // The point under the cursor in canvas space should stay fixed.
        // canvasX = screenX / oldZoom - panX  (must equal)  screenX / newZoom - newPanX
        // => newPanX = screenX / newZoom - screenX / oldZoom + panX
        const newPanX =
          focalScreenX / clamped - focalScreenX / prev.zoom + prev.panX;
        const newPanY =
          focalScreenY / clamped - focalScreenY / prev.zoom + prev.panY;
        return { zoom: clamped, panX: newPanX, panY: newPanY };
      });
    },
    [setViewport]
  );

  // Wheel handler — attach as non-passive to call preventDefault
  const handleWheel = useCallback(
    (e: WheelEvent, containerRect: DOMRect) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const screenX = e.clientX - containerRect.left;
      const screenY = e.clientY - containerRect.top;
      setViewport((prev) => {
        const newZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const newPanX =
          screenX / newZoom - screenX / prev.zoom + prev.panX;
        const newPanY =
          screenY / newZoom - screenY / prev.zoom + prev.panY;
        return { zoom: newZoom, panX: newPanX, panY: newPanY };
      });
    },
    [setViewport]
  );

  // +/- button zoom toward viewport center
  const zoomIn = useCallback(
    (containerWidth: number, containerHeight: number) => {
      zoomToPoint(
        viewport.zoom + ZOOM_STEP,
        containerWidth / 2,
        containerHeight / 2
      );
    },
    [viewport.zoom, zoomToPoint]
  );

  const zoomOut = useCallback(
    (containerWidth: number, containerHeight: number) => {
      zoomToPoint(
        viewport.zoom - ZOOM_STEP,
        containerWidth / 2,
        containerHeight / 2
      );
    },
    [viewport.zoom, zoomToPoint]
  );

  const resetZoom = useCallback(() => {
    setViewport({ zoom: 1, panX: 0, panY: 0 });
  }, [setViewport]);

  // Space key tracking for pan mode — skip when user is typing in a form element
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      isSpaceDownRef.current = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space") {
      isSpaceDownRef.current = false;
      isPanningRef.current = false;
      lastPointerRef.current = null;
    }
  }, []);

  // Pan via space + pointer drag
  const handlePointerDownForPan = useCallback(
    (e: React.PointerEvent) => {
      if (isSpaceDownRef.current) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }
    },
    []
  );

  const handlePointerMoveForPan = useCallback(
    (e: React.PointerEvent) => {
      if (isPanningRef.current && lastPointerRef.current) {
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        setViewport((prev) => ({
          ...prev,
          panX: prev.panX + dx / prev.zoom,
          panY: prev.panY + dy / prev.zoom,
        }));
      }
    },
    [setViewport]
  );

  const handlePointerUpForPan = useCallback(() => {
    isPanningRef.current = false;
    lastPointerRef.current = null;
  }, []);

  // Convert screen coordinates (relative to container) to canvas space
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => ({
      x: screenX / viewport.zoom - viewport.panX,
      y: screenY / viewport.zoom - viewport.panY,
    }),
    [viewport]
  );

  return {
    viewport,
    setViewport,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomToPoint,
    screenToCanvas,
    // Pan helpers
    isSpaceDown: isSpaceDownRef,
    isPanning: isPanningRef,
    handleKeyDown,
    handleKeyUp,
    handlePointerDownForPan,
    handlePointerMoveForPan,
    handlePointerUpForPan,
  };
}
