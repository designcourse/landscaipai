"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  VIDEO_MODELS,
  RESOLUTION_OPTIONS,
  DEFAULT_CAMERA_PRESET_ID,
  DEFAULT_TRANSITION_PRESET_ID,
  DEFAULT_VIDEO_MODEL_ID,
  DEFAULT_RESOLUTION,
  computeCreditCost,
  type ResolutionOption,
} from "@/lib/gemini/video-prompts";
import { useFloatingPanel } from "@/hooks/use-floating-panel";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  CloseIcon,
  MaximizeIcon,
  GripIcon,
  ResizeHandleIcon,
} from "./plant-browser-icons";

export interface VideoGenerationSubmit {
  modelId: string;
  cameraPresetId: string;
  transitionPresetId: string;
  resolution: ResolutionOption;
  customPrompt: string;
  swapped: boolean;
}

interface FramePreview {
  url: string;
  width: number;
  height: number;
}

interface VideoGenerationModalProps {
  startFrame: FramePreview;
  endFrame: FramePreview;
  credits: number;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: VideoGenerationSubmit) => void;
}

// Locked at 8s — first/last frame interpolation requirement (Veo 3.1).
const DURATION_SECONDS = 8;

// Floating-panel sizing (matches Plant Library conventions)
const TOP_GUTTER = 72;
const BOTTOM_GUTTER = 110;
const DEFAULT_WIDTH = 760;
const DEFAULT_HEIGHT = 540;
const MIN_WIDTH = 560;
const MIN_HEIGHT = 460;

export function VideoGenerationModal({
  startFrame,
  endFrame,
  credits,
  submitting,
  error,
  onClose,
  onSubmit,
}: VideoGenerationModalProps) {
  const [modelId, setModelId] = useState<string>(DEFAULT_VIDEO_MODEL_ID);
  const [resolution, setResolution] = useState<ResolutionOption>(DEFAULT_RESOLUTION);
  const [customPrompt, setCustomPrompt] = useState("");
  const [swapped, setSwapped] = useState(false);

  // Pill dropdown state
  const [openPill, setOpenPill] = useState<"model" | "res" | null>(null);
  const modelPillRef = useRef<HTMLDivElement>(null);
  const resPillRef = useRef<HTMLDivElement>(null);

  // On phones, the panel becomes a fullscreen takeover — drag/resize/maximize
  // make no sense at that size. Close button is the only way out.
  const isMobile = useIsMobile();

  // Floating panel bounds (drag/resize/maximize) — same hook as Plant Library.
  const { bounds, maximized, dragHandlers, resizeHandlers, toggleMaximize } =
    useFloatingPanel({
      storageKey: "video-generation-bounds-v1",
      initial: (() => {
        if (typeof window === "undefined") {
          return { x: 200, y: TOP_GUTTER + 24, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(DEFAULT_WIDTH, vw - 32);
        const height = Math.min(DEFAULT_HEIGHT, vh - TOP_GUTTER - BOTTOM_GUTTER);
        return {
          x: Math.max(16, Math.round((vw - width) / 2)),
          y: Math.max(
            TOP_GUTTER,
            Math.round((vh - height - BOTTOM_GUTTER) / 2) + TOP_GUTTER / 2,
          ),
          width,
          height,
        };
      })(),
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      topGutter: TOP_GUTTER,
      bottomGutter: BOTTOM_GUTTER,
    });

  const cost = useMemo(
    () => computeCreditCost({ modelId, durationSeconds: DURATION_SECONDS, resolution }),
    [modelId, resolution],
  );
  const insufficient = credits < cost;
  const selectedModel = VIDEO_MODELS.find((m) => m.id === modelId);
  const selectedRes = RESOLUTION_OPTIONS.find((r) => r.id === resolution);

  const displayStart = swapped ? endFrame : startFrame;
  const displayEnd = swapped ? startFrame : endFrame;

  function handleSubmit() {
    if (submitting || insufficient) return;
    onSubmit({
      modelId,
      // Camera + transition are intentionally hidden from the UI for now —
      // we ship baseline defaults until those presets are validated.
      cameraPresetId: DEFAULT_CAMERA_PRESET_ID,
      transitionPresetId: DEFAULT_TRANSITION_PRESET_ID,
      resolution,
      customPrompt,
      swapped,
    });
  }

  // Close on Escape (same as Plant Library)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        if (openPill) {
          setOpenPill(null);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, submitting, openPill]);

  // Click outside any open pill closes the popover.
  useEffect(() => {
    if (!openPill) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      const inModel = modelPillRef.current?.contains(t);
      const inRes = resPillRef.current?.contains(t);
      if (!inModel && !inRes) setOpenPill(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openPill]);

  // Submit on Cmd/Ctrl+Enter inside textarea
  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  // On mobile, override panel chrome to fullscreen takeover.
  const panelStyle: React.CSSProperties = isMobile
    ? { left: 0, top: 0, width: "100vw", height: "100dvh", boxShadow: "none" }
    : {
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        boxShadow: "var(--shadow-toolbar)",
      };

  return (
    <div
      role="dialog"
      aria-label="Generate Video"
      className={`fixed z-40 flex flex-col overflow-hidden bg-panel-main ${
        isMobile ? "" : "rounded-lg border border-panel-border"
      }`}
      style={panelStyle}
    >
      {/* Title bar — draggable on desktop, static on mobile */}
      <div
        className="flex h-[52px] shrink-0 select-none items-center gap-2.5 border-b border-panel-border bg-panel pl-4 pr-2.5"
        style={{ cursor: isMobile || maximized ? "default" : "grab" }}
        {...(isMobile ? {} : dragHandlers)}
      >
        {!isMobile && (
          <span className="text-muted-foreground/60" aria-hidden>
            <GripIcon className="h-3.5 w-3.5" />
          </span>
        )}
        <h2 className="text-[13px] font-semibold text-foreground">
          Generate Video
        </h2>

        <div className="flex flex-1" />

        {!isMobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximize();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-panel-subtle hover:text-foreground"
            title={maximized ? "Restore" : "Maximize"}
            aria-label={maximized ? "Restore" : "Maximize"}
          >
            <MaximizeIcon />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!submitting) onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={submitting}
          className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-panel-subtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title="Close"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div className="scrollbar-minimal flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto bg-panel-main px-4 py-5 sm:px-6">
        {/* Hero frames — always side-by-side so the prompt box is visible
            without scrolling. Each frame shrinks to fill half the row. */}
        <div className="relative flex items-center justify-center gap-2 sm:gap-3.5">
          <FrameTile label="START" frame={displayStart} accent="primary" />
          <button
            type="button"
            onClick={() => setSwapped((s) => !s)}
            title="Swap start and end frames"
            aria-label="Swap start and end frames"
            className="z-10 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-panel-border bg-white shadow-md transition-shadow hover:shadow-lg"
          >
            <SwapIcon />
          </button>
          <FrameTile label="END" frame={displayEnd} accent="warning" />
        </div>

        {/* Chat input card */}
        <div className="flex flex-col gap-4 rounded-[14px] border border-panel-border bg-white p-4">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder='Describe the transition between your two frames…&#10;e.g. "morph naturally over 8 seconds, emphasize water reflections, slight golden-hour shift"'
            rows={3}
            className="min-h-[88px] w-full resize-none bg-transparent text-[15px] leading-snug text-foreground placeholder:text-[#acacac] focus:outline-none"
          />

          {/* Pill row — wraps on narrow screens so long model names don't
              squeeze into a vertical jumble. */}
          <div className="flex min-h-9 flex-wrap items-center gap-2">
            {/* MODEL pill */}
            <div className="relative" ref={modelPillRef}>
              <button
                type="button"
                onClick={() => setOpenPill((p) => (p === "model" ? null : "model"))}
                className="flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-primary bg-primary-tint/50 px-3 transition-colors hover:bg-primary-tint"
                style={{ backgroundColor: "rgba(216, 230, 211, 0.45)" }}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-panel-muted">
                  Model
                </span>
                <span className="text-[12px] font-semibold text-primary-dark">
                  {selectedModel?.name}
                </span>
                <span className="text-[9px] text-panel-muted">▾</span>
              </button>
              {openPill === "model" && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-lg border border-panel-border bg-white shadow-lg">
                  {VIDEO_MODELS.map((m) => {
                    const mCost = computeCreditCost({
                      modelId: m.id,
                      durationSeconds: DURATION_SECONDS,
                      resolution,
                    });
                    const sel = m.id === modelId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModelId(m.id);
                          setOpenPill(null);
                        }}
                        className={`flex w-full cursor-pointer flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-panel-subtle ${
                          sel ? "bg-panel-subtle" : ""
                        }`}
                      >
                        <div className="flex w-full items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            {m.name}
                          </span>
                          <span className="ml-auto rounded-full bg-panel-chip px-1.5 py-px text-[10px] font-bold uppercase text-panel-muted">
                            {mCost} cr
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {m.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RES pill */}
            <div className="relative" ref={resPillRef}>
              <button
                type="button"
                onClick={() => setOpenPill((p) => (p === "res" ? null : "res"))}
                className="flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-panel-border bg-panel-subtle px-3 transition-colors hover:bg-panel-chip"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-panel-muted">
                  Res
                </span>
                <span className="text-[12px] font-semibold text-foreground">
                  {selectedRes?.label}
                </span>
                <span className="text-[9px] text-panel-muted">▾</span>
              </button>
              {openPill === "res" && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-lg border border-panel-border bg-white shadow-lg">
                  {RESOLUTION_OPTIONS.map((r) => {
                    const sel = r.id === resolution;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setResolution(r.id);
                          setOpenPill(null);
                        }}
                        className={`flex w-full cursor-pointer flex-col items-start gap-0.5 px-3.5 py-2 text-left transition-colors hover:bg-panel-subtle ${
                          sel ? "bg-panel-subtle" : ""
                        }`}
                      >
                        <span className="text-[13px] font-semibold text-foreground">
                          {r.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {r.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Duration locked chip */}
            <div
              className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-panel-border px-3"
              style={{ backgroundColor: "var(--color-panel-search)" }}
              title="Duration is fixed at 8s for first/last frame interpolation"
            >
              <span className="text-[10px]" aria-hidden>
                🔒
              </span>
              <span className="text-[12px] font-semibold text-foreground">8s</span>
            </div>

            <div className="flex-1" />

            {/* Inline send button (chat-style shortcut) */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || insufficient}
              title={
                insufficient
                  ? `Need ${cost - credits} more credits`
                  : `Generate video (${cost} credits)`
              }
              aria-label="Generate video"
              className="flex h-8 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        {/* Error inline */}
        {error && (
          <div className="rounded-md bg-destructive/10 px-3.5 py-2 text-[13px] text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex h-[54px] shrink-0 items-center gap-2.5 border-t border-panel-border bg-panel-subtle px-4"
      >
        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[12px]">
          <span className="font-medium text-panel-muted">Cost</span>
          <span className="font-semibold text-foreground">{cost} credits</span>
          <span className="hidden text-panel-muted sm:inline">·</span>
          <span className="hidden font-medium text-panel-muted sm:inline">
            {credits} credits available
          </span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => !submitting && onClose()}
          disabled={submitting}
          className="flex h-[30px] cursor-pointer items-center justify-center rounded-md border border-panel-border bg-white px-3.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:bg-panel-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || insufficient}
          title={insufficient ? `Need ${cost - credits} more credits` : `Generate video (${cost} credits)`}
          className="flex h-[30px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-4 text-[12px] font-semibold text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayIcon />
          {submitting
            ? "Starting…"
            : insufficient
              ? "Insufficient credits"
              : "Generate Video"}
        </button>
      </div>

      {/* Resize handle — desktop only */}
      {!isMobile && !maximized && (
        <button
          type="button"
          aria-label="Resize panel"
          className="absolute bottom-0 right-0 flex h-4 w-4 items-end justify-end p-0.5 text-muted-foreground/60 hover:text-foreground"
          style={{ cursor: "nwse-resize", background: "transparent" }}
          {...resizeHandlers}
        >
          <ResizeHandleIcon />
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------
function FrameTile({
  label,
  frame,
  accent,
}: {
  label: string;
  frame: FramePreview;
  accent: "primary" | "warning";
}) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frame.url}
        alt={label}
        draggable={false}
        className="block h-auto w-full select-none object-cover"
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
      />
      {/* Corner badge */}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        <span
          className={`h-[5px] w-[5px] rounded-full ${
            accent === "primary" ? "bg-primary" : "bg-warning"
          }`}
        />
        {label}
      </span>
    </div>
  );
}

function SwapIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#171717"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}
