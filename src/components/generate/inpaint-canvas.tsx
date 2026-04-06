"use client";

import { useRef, useState, useEffect } from "react";

const MASK_COLOR = "#0F8000";
const MIN_BRUSH = 10;
const MAX_BRUSH = 120;
const DEFAULT_BRUSH = 30;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  tool: "brush" | "eraser";
  size: number;
}

interface InpaintCanvasProps {
  imageUrl: string;
  onConfirm: (maskOverlayBase64: string, rawMaskBase64: string) => void;
  onCancel: () => void;
}

export function InpaintCanvas({
  imageUrl,
  onConfirm,
  onCancel,
}: InpaintCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH);
  const [strokeCount, setStrokeCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  // Drawing state in refs (avoid stale closures during pointer events)
  const isDrawing = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const allStrokesRef = useRef<Stroke[]>([]);
  const pinchRef = useRef<{ dist: number; center: Point } | null>(null);

  // --- Load image ---
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const mask = document.createElement("canvas");
      mask.width = img.naturalWidth;
      mask.height = img.naturalHeight;
      maskCanvasRef.current = mask;
      setLoaded(true);
    };
    img.onerror = () => {
      // Fallback: try without crossOrigin (won't be able to export, but at least shows the image)
      img.crossOrigin = "";
      img.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // --- Resize display canvas ---
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !loaded) return;

    const ro = new ResizeObserver((entries) => {
      const canvas = canvasRef.current;
      if (!canvas || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      canvas.width = width;
      canvas.height = height;
      redraw();
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [loaded]);

  // --- Redraw on state changes ---
  useEffect(() => {
    redraw();
  }, [loaded, zoom, pan, strokeCount]);

  // --- Wheel zoom (needs non-passive listener) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(5, Math.max(0.5, prev * factor)));
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [loaded]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  // --- Redraw display canvas ---
  function redraw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const mask = maskCanvasRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Compute image transform
    const scale =
      Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight) * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const ox = (canvas.width - drawW) / 2 + pan.x;
    const oy = (canvas.height - drawH) / 2 + pan.y;

    // Draw image
    ctx.drawImage(img, ox, oy, drawW, drawH);

    // Draw mask overlay
    if (mask) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(mask, ox, oy, drawW, drawH);
      ctx.globalAlpha = 1;
    }
  }

  // --- Screen to image coordinate transform ---
  function screenToImage(clientX: number, clientY: number): Point | null {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return null;

    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;

    const scale =
      Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight) * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const ox = (canvas.width - drawW) / 2 + pan.x;
    const oy = (canvas.height - drawH) / 2 + pan.y;

    const ix = (cx - ox) / scale;
    const iy = (cy - oy) / scale;

    return {
      x: Math.max(0, Math.min(img.naturalWidth, ix)),
      y: Math.max(0, Math.min(img.naturalHeight, iy)),
    };
  }

  // --- Draw stroke on mask canvas ---
  function drawStrokeOnMask(stroke: Stroke) {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = MASK_COLOR;
      ctx.fillStyle = MASK_COLOR;
    }

    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
  }

  function drawSegmentOnMask(
    p1: Point,
    p2: Point,
    strokeTool: "brush" | "eraser",
    size: number
  ) {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;

    if (strokeTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = MASK_COLOR;
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
  }

  function rebuildMask(strokeList: Stroke[]) {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mask.width, mask.height);
    for (const s of strokeList) {
      drawStrokeOnMask(s);
    }
  }

  // --- Pointer event handlers ---
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch" && pinchRef.current) return;

    const point = screenToImage(e.clientX, e.clientY);
    if (!point) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;

    const stroke: Stroke = { points: [point], tool, size: brushSize };
    currentStrokeRef.current = stroke;

    drawStrokeOnMask(stroke);
    redraw();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || !currentStrokeRef.current) return;
    if (e.pointerType === "touch" && pinchRef.current) return;

    const point = screenToImage(e.clientX, e.clientY);
    if (!point) return;

    const stroke = currentStrokeRef.current;
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);

    drawSegmentOnMask(prev, point, stroke.tool, stroke.size);
    redraw();
  }

  function finishStroke() {
    if (!isDrawing.current || !currentStrokeRef.current) return;
    isDrawing.current = false;

    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    allStrokesRef.current = [...allStrokesRef.current, finished];
    setStrokeCount((prev) => prev + 1);
  }

  // --- Touch handlers for pinch-to-zoom ---
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      // Cancel active drawing
      if (isDrawing.current && currentStrokeRef.current) {
        isDrawing.current = false;
        currentStrokeRef.current = null;
        rebuildMask(allStrokesRef.current);
        redraw();
      }

      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchRef.current = {
        dist: Math.sqrt(dx * dx + dy * dy),
        center: {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        },
      };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };

      const scaleDelta = dist / pinchRef.current.dist;
      setZoom((prev) => Math.min(5, Math.max(0.5, prev * scaleDelta)));

      const panDx = center.x - pinchRef.current.center.x;
      const panDy = center.y - pinchRef.current.center.y;
      setPan((prev) => ({ x: prev.x + panDx, y: prev.y + panDy }));

      pinchRef.current = { dist, center };
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
  }

  // --- Undo ---
  function undo() {
    const next = allStrokesRef.current.slice(0, -1);
    allStrokesRef.current = next;
    rebuildMask(next);
    setStrokeCount((prev) => Math.max(0, prev - 1));
  }

  // --- Clear ---
  function clearAll() {
    allStrokesRef.current = [];
    rebuildMask([]);
    setStrokeCount(0);
  }

  // --- Confirm ---
  function handleConfirm() {
    const img = imgRef.current;
    const mask = maskCanvasRef.current;
    if (!img || !mask) return;

    // Verify mask has content
    const maskCtx = mask.getContext("2d");
    if (!maskCtx) return;
    const data = maskCtx.getImageData(0, 0, mask.width, mask.height);
    let hasMask = false;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] > 0) {
        hasMask = true;
        break;
      }
    }
    if (!hasMask) return;

    try {
      // Composite: image + mask overlay (for Gemini prompt)
      const comp = document.createElement("canvas");
      comp.width = img.naturalWidth;
      comp.height = img.naturalHeight;
      const ctx = comp.getContext("2d")!;

      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(mask, 0, 0);
      ctx.globalAlpha = 1;

      const overlayBase64 = comp.toDataURL("image/jpeg", 0.85);

      // Raw mask: white where painted, black elsewhere (for server-side compositing)
      const rawMask = document.createElement("canvas");
      rawMask.width = img.naturalWidth;
      rawMask.height = img.naturalHeight;
      const rawCtx = rawMask.getContext("2d")!;

      // Fill black background
      rawCtx.fillStyle = "#000000";
      rawCtx.fillRect(0, 0, rawMask.width, rawMask.height);

      // Read the mask canvas pixels — anywhere with alpha > 0 becomes white
      const maskPixels = maskCtx.getImageData(0, 0, mask.width, mask.height);
      const rawPixels = rawCtx.getImageData(0, 0, rawMask.width, rawMask.height);
      for (let i = 0; i < maskPixels.data.length; i += 4) {
        if (maskPixels.data[i + 3] > 0) {
          rawPixels.data[i] = 255;     // R
          rawPixels.data[i + 1] = 255; // G
          rawPixels.data[i + 2] = 255; // B
          rawPixels.data[i + 3] = 255; // A
        }
      }
      rawCtx.putImageData(rawPixels, 0, 0);

      const rawMaskBase64 = rawMask.toDataURL("image/png");

      onConfirm(overlayBase64, rawMaskBase64);
    } catch (err) {
      console.error("[InpaintCanvas] Failed to export mask — possible CORS/tainted canvas:", err);
    }
  }

  const hasStrokes = strokeCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Toolbar — bottom on mobile, top on desktop */}
      <div className="order-2 flex items-center justify-between gap-2 border-t border-border bg-background px-3 py-2 lg:order-1 lg:border-b lg:border-t-0">
        <div className="flex items-center gap-1">
          {/* Brush */}
          <button
            type="button"
            onClick={() => setTool("brush")}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors ${
              tool === "brush"
                ? "bg-primary/10 text-primary ring-1 ring-primary"
                : "text-foreground hover:bg-muted"
            }`}
            title="Brush"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors ${
              tool === "eraser"
                ? "bg-primary/10 text-primary ring-1 ring-primary"
                : "text-foreground hover:bg-muted"
            }`}
            title="Eraser"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 20H7l-4-4c-.6-.6-.6-1.5 0-2.1l9.5-9.5c.6-.6 1.5-.6 2.1 0l5 5c.6.6.6 1.5 0 2.1L13.5 17.5"
              />
            </svg>
          </button>

          <div className="mx-1 h-6 w-px bg-border" />

          {/* Brush size */}
          <div className="flex items-center gap-2 px-1">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Size
            </span>
            <input
              type="range"
              min={MIN_BRUSH}
              max={MAX_BRUSH}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-16 accent-primary sm:w-24"
            />
          </div>

          <div className="mx-1 h-6 w-px bg-border" />

          {/* Undo */}
          <button
            type="button"
            onClick={undo}
            disabled={!hasStrokes}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 14L4 9l5-5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 9h10.5a5.5 5.5 0 010 11H13"
              />
            </svg>
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={clearAll}
            disabled={!hasStrokes}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-30"
            title="Clear all"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

        {/* Cancel / Done */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasStrokes}
            className="min-h-[44px] rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative order-1 flex-1 overflow-hidden bg-foreground/95 lg:order-2"
        style={{ touchAction: "none" }}
      >
        {!loaded ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-white/60">Loading image...</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        )}

        {/* Zoom indicator */}
        {zoom !== 1 && (
          <div className="absolute bottom-3 left-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground">
            {Math.round(zoom * 100)}%
          </div>
        )}

        {/* Hint text */}
        {loaded && !hasStrokes && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center lg:bottom-auto lg:top-3">
            <p className="rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
              Paint over the area you want to edit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
