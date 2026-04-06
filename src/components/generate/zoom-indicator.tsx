"use client";

interface ZoomIndicatorProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomIndicator({ zoom, onZoomIn, onZoomOut, onReset }: ZoomIndicatorProps) {
  const percentage = Math.round(zoom * 100);

  return (
    <div
      className="absolute bottom-7 left-5 z-10 flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5"
      style={{ boxShadow: "0px 2px 8px -1px rgba(0,0,0,0.08)" }}
    >
      <button
        onClick={onZoomOut}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        onClick={onReset}
        className="min-w-[36px] text-center text-[11px] font-medium text-foreground"
        aria-label="Reset zoom"
      >
        {percentage}%
      </button>
      <button
        onClick={onZoomIn}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
