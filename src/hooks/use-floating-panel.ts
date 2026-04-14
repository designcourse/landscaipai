"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseFloatingPanelOptions {
  storageKey?: string;
  initial: PanelBounds;
  minWidth: number;
  minHeight: number;
  /** Pixels of viewport to keep clear at the bottom (for the canvas bottom bar). */
  bottomGutter: number;
  /** Pixels of viewport to keep clear at the top (for the canvas toolbar). */
  topGutter: number;
}

function clampBounds(
  b: PanelBounds,
  opts: UseFloatingPanelOptions,
): PanelBounds {
  if (typeof window === "undefined") return b;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(b.width, opts.minWidth), vw - 16);
  const maxHeight = Math.max(
    opts.minHeight,
    vh - opts.topGutter - opts.bottomGutter,
  );
  const height = Math.min(Math.max(b.height, opts.minHeight), maxHeight);
  const x = Math.min(Math.max(b.x, 8), Math.max(8, vw - width - 8));
  const y = Math.min(
    Math.max(b.y, opts.topGutter),
    Math.max(opts.topGutter, vh - opts.bottomGutter - height),
  );
  if (x === b.x && y === b.y && width === b.width && height === b.height) {
    return b; // preserve reference so React short-circuits
  }
  return { x, y, width, height };
}

/**
 * Minimal drag + resize state machine for a floating panel.
 * Uses pointer events. No backdrop.
 */
export function useFloatingPanel(opts: UseFloatingPanelOptions) {
  const [bounds, setBounds] = useState<PanelBounds>(() => {
    if (typeof window !== "undefined" && opts.storageKey) {
      try {
        const raw = localStorage.getItem(opts.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as PanelBounds;
          if (
            typeof parsed.x === "number" &&
            typeof parsed.y === "number" &&
            typeof parsed.width === "number" &&
            typeof parsed.height === "number"
          ) {
            return clampBounds(parsed, opts);
          }
        }
      } catch {
        /* ignore */
      }
    }
    return clampBounds(opts.initial, opts);
  });

  const [maximized, setMaximized] = useState(false);
  const preMaxBounds = useRef<PanelBounds | null>(null);

  // Persist bounds (only when not maximized). Debounced so a drag doesn't
  // hammer localStorage at 60Hz.
  useEffect(() => {
    if (maximized) return;
    if (!opts.storageKey) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(opts.storageKey!, JSON.stringify(bounds));
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(id);
  }, [bounds, maximized, opts.storageKey]);

  // Re-clamp on window resize.
  useEffect(() => {
    function onResize() {
      setBounds((b) => clampBounds(b, opts));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // opts is stable enough for this hook's usage; we don't want to re-bind on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drag = useRef<{
    startX: number;
    startY: number;
    origin: PanelBounds;
    pointerId: number;
  } | null>(null);

  const resize = useRef<{
    startX: number;
    startY: number;
    origin: PanelBounds;
    pointerId: number;
  } | null>(null);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (maximized) return;
      drag.current = {
        startX: e.clientX,
        startY: e.clientY,
        origin: bounds,
        pointerId: e.pointerId,
      };
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {
        /* already captured or target not capturable */
      }
    },
    [bounds, maximized],
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const cur = drag.current;
      if (!cur) return;
      const dx = e.clientX - cur.startX;
      const dy = e.clientY - cur.startY;
      setBounds((b) =>
        clampBounds(
          {
            x: cur.origin.x + dx,
            y: cur.origin.y + dy,
            width: b.width,
            height: b.height,
          },
          opts,
        ),
      );
    },
    // opts is stable; we capture it at hook creation time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onDragPointerUp = useCallback((e: React.PointerEvent) => {
    if (drag.current?.pointerId === e.pointerId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      drag.current = null;
    }
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (maximized) return;
      e.stopPropagation();
      resize.current = {
        startX: e.clientX,
        startY: e.clientY,
        origin: bounds,
        pointerId: e.pointerId,
      };
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {
        /* already captured or target not capturable */
      }
    },
    [bounds, maximized],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const cur = resize.current;
      if (!cur) return;
      const dx = e.clientX - cur.startX;
      const dy = e.clientY - cur.startY;
      setBounds((b) =>
        clampBounds(
          {
            x: b.x,
            y: b.y,
            width: cur.origin.width + dx,
            height: cur.origin.height + dy,
          },
          opts,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (resize.current?.pointerId === e.pointerId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      resize.current = null;
    }
  }, []);

  const toggleMaximize = useCallback(() => {
    setMaximized((prev) => {
      if (prev) {
        // Restore.
        if (preMaxBounds.current) {
          setBounds(clampBounds(preMaxBounds.current, opts));
        }
        return false;
      }
      // Maximize.
      preMaxBounds.current = bounds;
      if (typeof window !== "undefined") {
        setBounds(
          clampBounds(
            {
              x: 16,
              y: opts.topGutter,
              width: window.innerWidth - 32,
              height:
                window.innerHeight - opts.topGutter - opts.bottomGutter,
            },
            opts,
          ),
        );
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  return {
    bounds,
    maximized,
    dragHandlers: {
      onPointerDown: onDragPointerDown,
      onPointerMove: onDragPointerMove,
      onPointerUp: onDragPointerUp,
      onPointerCancel: onDragPointerUp,
    },
    resizeHandlers: {
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
      onPointerCancel: onResizePointerUp,
    },
    toggleMaximize,
  };
}
