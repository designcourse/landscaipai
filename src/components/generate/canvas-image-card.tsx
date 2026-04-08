"use client";

import { useState, useRef, useCallback, memo } from "react";
import type { Generation } from "@/types";
import type { ItemPosition } from "@/hooks/use-canvas-positions";

type GenerationWithUrl = Generation & { url: string };

export interface CanvasItem {
  id: string;
  type: "original" | "generation" | "video" | "finalized_video";
  imageId: string;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  generation?: GenerationWithUrl;
  title?: string;
  libraryTags?: { name: string; thumbnailUrl: string; id?: string }[];
  userPrompt?: string; // The user's custom prompt only (not the system prompt)
  settingsSummary?: string; // e.g. "Summer · Partly Cloudy"
  // For video items: "generating" shows start-frame poster with long-loading notice
  status?: "ready" | "generating" | "revealing";
  sourceUrl?: string; // URL of the source image (shown during generation animation)
  // Video-specific fields
  durationSeconds?: number;    // for display ("8s")
  videoModel?: string;         // for display ("Veo 3.1 Fast")
  cameraPreset?: string;       // for display
  transitionPreset?: string;   // for display
  // Finalized-video-specific: id of the source video_generations row
  sourceVideoGenerationId?: string;
}

interface CanvasImageCardProps {
  item: CanvasItem;
  position: ItemPosition;
  selected: boolean;
  zoom: number;
  isSpaceDown: React.RefObject<boolean>;
  onSelect: (id: string, e?: React.PointerEvent | React.MouseEvent) => void;
  onPositionChange: (id: string, partial: Partial<ItemPosition>) => void;
  onEditRegion: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onLibraryTagClick?: (tagId: string) => void;
  /** Triggered when user clicks "Finalize Video" on a video card. */
  onRequestFinalize?: (videoGenerationId: string) => void;
}

const RESIZE_HANDLE_SIZE = 10;
const MIN_WIDTH = 100;

export const CanvasImageCard = memo(function CanvasImageCard({
  item,
  position,
  selected,
  zoom,
  isSpaceDown,
  onSelect,
  onPositionChange,
  onEditRegion,
  onRequestDelete,
  onLibraryTagClick,
  onRequestFinalize,
}: CanvasImageCardProps) {
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef<{ x: number; y: number; itemX: number; itemY: number } | null>(null);
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const aspect = position.height / position.width;

  // --- Drag ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isSpaceDown.current) return; // Let pan handler take over
      if ((e.target as HTMLElement).dataset.resizeHandle) return; // Resize handle

      e.stopPropagation();
      onSelect(item.id, e);

      isDragging.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        itemX: position.x,
        itemY: position.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [item.id, position.x, position.y, onSelect, isSpaceDown]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging.current && dragStart.current) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        const dy = (e.clientY - dragStart.current.y) / zoom;
        onPositionChange(item.id, {
          x: dragStart.current.itemX + dx,
          y: dragStart.current.itemY + dy,
        });
      }
      if (isResizing.current && resizeStart.current) {
        const dx = (e.clientX - resizeStart.current.x) / zoom;
        const newWidth = Math.max(MIN_WIDTH, resizeStart.current.width + dx);
        const newHeight = newWidth * aspect;
        onPositionChange(item.id, { width: newWidth, height: newHeight });
      }
    },
    [item.id, zoom, aspect, onPositionChange]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    isResizing.current = false;
    dragStart.current = null;
    resizeStart.current = null;
  }, []);

  // --- Resize ---
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelect(item.id);
      isResizing.current = true;
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        width: position.width,
        height: position.height,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [item.id, position.width, position.height, onSelect]
  );

  const isGenerating = item.status === "generating";
  const isRevealing = item.status === "revealing";
  // Both raw veo videos and finalized renders use the same <video> rendering
  // path, hover affordances, and download flow.
  const isVideo = item.type === "video" || item.type === "finalized_video";
  const isFinalized = item.type === "finalized_video";

  // Progressive disclosure: fade out metadata below images at low zoom to prevent overlap.
  // Cards are only 30px apart, so counter-scaling text causes immediate overlap.
  // Instead, we hide details when zoomed out (standard canvas UX — zoom in for details).
  const DETAIL_FADE_START = 0.75; // begin fading
  const DETAIL_FADE_END = 0.55;   // fully hidden
  const detailOpacity = zoom >= DETAIL_FADE_START ? 1
    : zoom <= DETAIL_FADE_END ? 0
    : (zoom - DETAIL_FADE_END) / (DETAIL_FADE_START - DETAIL_FADE_END);

  // Title sits above the image and is short ("AI GENERATED"), so counter-scaling
  // won't overflow into adjacent cards. Cap at 2.5x to be safe.
  const titleScale = Math.max(1, Math.min(13 / (12 * zoom), 2.5));

  // Edit Region button is inside the image (overflow-hidden), so counter-scaling is safe.
  const editScale = Math.max(1, Math.min(13 / (14 * zoom), 2.0));
  // Images: show Edit Region. Videos: show only a download button.
  const showEditRegion = hovered && !isGenerating && !isRevealing && !isVideo && zoom >= 0.4;
  const showVideoDownload = hovered && !isGenerating && isVideo && zoom >= 0.4;

  // Trigger a download of the current item (image or video)
  const triggerDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = item.url;
    const ext = isVideo
      ? "mp4"
      : item.type === "original"
        ? "jpg"
        : "webp";
    const prefix = isFinalized
      ? "finalized"
      : isVideo
        ? "video"
        : item.type === "original"
          ? "original"
          : "generation";
    a.download = `${prefix}-${item.id.slice(0, 8)}.${ext}`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [item.id, item.url, item.type, isVideo, isFinalized]);

  return (
    <div
      className="absolute select-none"
      style={{
        left: position.x,
        top: position.y,
        width: position.width,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
    >
      {/* Title (generations + videos + finalized videos) */}
      {(item.type === "generation" ||
        item.type === "video" ||
        item.type === "finalized_video") &&
        item.title && (
        <p
          className="mb-3 text-xs font-bold uppercase tracking-wider"
          style={{
            color: "var(--color-canvas-label)",
            transform: titleScale > 1 ? `scale(${titleScale})` : undefined,
            transformOrigin: "bottom left",
          }}
        >
          {item.title}
        </p>
      )}

      {/* Image container */}
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          width: position.width,
          height: position.height,
          boxShadow: "0px 2px 8px 0px rgba(0,0,0,0.05), 0px 14px 18.5px -4px rgba(0,0,0,0.17)",
        }}
      >
        {/* Source image (shown during generation as the "before") */}
        {isGenerating && item.sourceUrl && (
          <img
            src={item.sourceUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        )}

        {/* Actual image (non-video) */}
        {!isGenerating && !isVideo && (
          <img
            src={item.url}
            alt={item.title || (item.type === "original" ? "Original photo" : "Generated result")}
            className="h-full w-full object-cover"
            style={{
              opacity: isRevealing && !revealed ? 0 : 1,
              transition: isRevealing ? "opacity 2s ease" : "none",
            }}
            onLoad={() => {
              if (isRevealing) {
                // Trigger the reveal transition after the image loads
                requestAnimationFrame(() => setRevealed(true));
              }
            }}
            draggable={false}
          />
        )}

        {/* Video element — muted because Veo 3.1 via the Gemini Developer API
            always generates synchronized audio (the generateAudio config field
            is Vertex-AI-only and is rejected by the Gemini API). Muting at the
            element is the only reliable way to prevent audio playback. */}
        {!isGenerating && isVideo && (
          <video
            src={item.url}
            className="h-full w-full object-cover"
            controls
            controlsList="nodownload"
            muted
            playsInline
            preload="metadata"
            poster={item.sourceUrl}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Shimmer animation overlay during generation */}
        {isGenerating && (
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              animation: "canvas-shimmer 2s infinite linear",
            }}
          />
        )}

        {/* Long-running notice for video generations in progress */}
        {isGenerating && isVideo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="flex flex-col items-center gap-1 rounded-lg px-4 py-3 text-center"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.55)",
                color: "white",
                transform: titleScale > 1 ? `scale(${titleScale})` : undefined,
              }}
            >
              <span className="text-sm font-semibold">Generating video…</span>
              <span className="text-xs opacity-80">This may take a few minutes</span>
            </div>
          </div>
        )}

        {/* Selection outline */}
        {selected && (
          <div className="pointer-events-none absolute inset-0 rounded-md border-2 border-blue-500" />
        )}

        {/* Finalized badge — small glass pill in the top-left of the video */}
        {isFinalized && (
          <div
            className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{
              backgroundColor: "rgba(15, 15, 18, 0.6)",
              backdropFilter: "blur(12px) saturate(140%)",
              WebkitBackdropFilter: "blur(12px) saturate(140%)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              transform: editScale > 1 ? `scale(${editScale})` : undefined,
              transformOrigin: "top left",
            }}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Finalized
          </div>
        )}

        {/* Video hover actions: download + 3-dot menu (matches image-card pattern) */}
        {showVideoDownload && (
          <div
            className="absolute right-4 top-4 flex items-center gap-2"
            style={{
              transform: editScale > 1 ? `scale(${editScale})` : undefined,
              transformOrigin: "top right",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerDownload();
              }}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white shadow-lg transition-shadow hover:shadow-xl"
              title="Download video"
              aria-label="Download video"
            >
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#1a1a1a"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white shadow-lg transition-shadow hover:shadow-xl"
              title="More actions"
              aria-label="More actions"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1a1a1a">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        )}

        {/* Hover action buttons (Edit Region + 3-dot menu) */}
        {showEditRegion && (
          <div
            className="absolute right-4 top-4 flex items-center gap-2"
            style={{
              transform: editScale > 1 ? `scale(${editScale})` : undefined,
              transformOrigin: "top right",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditRegion(item.id);
              }}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-lg transition-shadow hover:shadow-xl"
              style={{ color: "#1a1a1a" }}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Region
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white shadow-lg transition-shadow hover:shadow-xl"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1a1a1a">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 3-dot dropdown menu — rendered outside overflow-hidden container */}
      {menuOpen && (
        <div
          className="absolute z-50"
          style={{
            right: 16,
            top: ((item.type === "generation" || item.type === "video") && item.title ? 28 : 0) + 16,
            transform: editScale > 1 ? `scale(${editScale})` : undefined,
            transformOrigin: "top right",
          }}
        >
          <div className="mt-12 min-w-[160px] rounded-lg bg-white py-1 shadow-lg" style={{ border: "1px solid var(--color-border)" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                // Download the image via a temporary anchor
                const a = document.createElement("a");
                a.href = item.url;
                a.download = item.type === "original" ? "original.jpg" : `generation-${item.id.slice(0, 8)}.webp`;
                a.target = "_blank";
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-100"
              style={{ color: "var(--color-foreground)" }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            {item.type === "video" && onRequestFinalize && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onRequestFinalize(item.id);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-100"
                style={{ color: "var(--color-foreground)" }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Finalize Video
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onRequestDelete(item.id);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50"
              style={{ color: "var(--color-destructive)" }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Resize handles (selected only) — corners hug the image, not the metadata */}
      {selected && !isGenerating && (() => {
        // Title adds ~28px above the image for generations + videos (text-xs + mb-3)
        const titleOffset =
          (item.type === "generation" ||
            item.type === "video" ||
            item.type === "finalized_video") && item.title ? 28 : 0;
        const imgTop = titleOffset - RESIZE_HANDLE_SIZE / 2;
        const imgBottom = titleOffset + position.height - RESIZE_HANDLE_SIZE / 2;
        return (
          <>
            {/* Top-left */}
            <div
              data-resize-handle="true"
              className="absolute cursor-nw-resize rounded-full border-2 border-blue-500 bg-white"
              style={{ left: -RESIZE_HANDLE_SIZE / 2, top: imgTop, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            {/* Top-right */}
            <div
              data-resize-handle="true"
              className="absolute cursor-ne-resize rounded-full border-2 border-blue-500 bg-white"
              style={{ right: -RESIZE_HANDLE_SIZE / 2, top: imgTop, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            {/* Bottom-left */}
            <div
              data-resize-handle="true"
              className="absolute cursor-sw-resize rounded-full border-2 border-blue-500 bg-white"
              style={{ left: -RESIZE_HANDLE_SIZE / 2, top: imgBottom, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            {/* Bottom-right */}
            <div
              data-resize-handle="true"
              className="absolute cursor-se-resize rounded-full border-2 border-blue-500 bg-white"
              style={{ right: -RESIZE_HANDLE_SIZE / 2, top: imgBottom, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </>
        );
      })()}

      {/* Library tags (generations only) — fade out when zoomed out to prevent overlap */}
      {detailOpacity > 0 && item.type === "generation" && item.libraryTags && item.libraryTags.length > 0 && (
        <div className="mt-7 flex gap-4" style={{ opacity: detailOpacity }}>
          {item.libraryTags.map((tag) => (
            <button
              key={tag.name}
              className="flex h-[38px] cursor-pointer items-center gap-1 rounded-[7px] bg-white p-[11px] transition-shadow hover:shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                if (tag.id && onLibraryTagClick) onLibraryTagClick(tag.id);
              }}
            >
              {tag.thumbnailUrl && (
                <img
                  src={tag.thumbnailUrl}
                  alt=""
                  className="h-[29px] w-[29px] rounded object-cover"
                  draggable={false}
                />
              )}
              <span className="text-sm font-bold text-black">{tag.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Prompt + settings (generations + videos + finalized) — fade out when zoomed out */}
      {detailOpacity > 0 &&
        (item.type === "generation" ||
          item.type === "video" ||
          item.type === "finalized_video") &&
        (item.userPrompt || item.settingsSummary) && (
        <div className="mt-7" style={{ opacity: detailOpacity }}>
          {item.userPrompt && (
            <>
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--color-canvas-label)" }}
              >
                PROMPT
              </p>
              <p className="mt-2 text-sm leading-[21px] text-black" style={{ maxWidth: 553 }}>
                {item.userPrompt}
              </p>
            </>
          )}
          {item.settingsSummary && (
            <p
              className="font-bold uppercase tracking-wider"
              style={{
                color: "var(--color-canvas-label)",
                fontSize: "0.75rem",
                marginTop: 20,
              }}
            >
              {item.settingsSummary}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
