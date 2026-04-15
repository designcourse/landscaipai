"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import {
  FinalizeVideo,
  FinalizeVideoProps,
} from "../../../remotion/compositions/FinalizeVideo";
import {
  COMPOSITION_FPS,
  FREEZE_HOLD_SECONDS,
  PLANT_INFO_SECONDS_PER_ASSET,
} from "../../../remotion/lib/timing";
import type { LibraryItem } from "@/types";
import { PlantBrowser } from "./plant-browser";
import { useFloatingPanel } from "@/hooks/use-floating-panel";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  CloseIcon,
  MaximizeIcon,
  GripIcon,
  ResizeHandleIcon,
} from "./plant-browser-icons";

const NOTE_MAX_LENGTH = 500;
const ADDRESS_MAX_LENGTH = 200;
const POLL_INTERVAL_MS = 2500;

// Panel chrome sizing — same conventions as Plant Library + Video modal.
const TOP_GUTTER = 72;
const BOTTOM_GUTTER = 110;
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 660;
const MIN_WIDTH = 720;
const MIN_HEIGHT = 540;

interface DetectedAsset {
  id: string;
  name: string;
  thumbnail_url: string;
  description: string | null;
  zone_min: string | null;
  zone_max: string | null;
  height_min_ft: number | null;
  height_max_ft: number | null;
  spread_min_ft: number | null;
  spread_max_ft: number | null;
  sun_requirement: string | null;
  water_needs: string | null;
  growth_rate: string | null;
  maintenance_level: string | null;
}

interface PreviewData {
  videoGenerationId: string;
  veo: {
    signedUrl: string;
    durationSeconds: number;
    fps: number;
    width: number;
    height: number;
  };
  detectedAssets: DetectedAsset[];
  branding: {
    companyName: string | null;
    companyPhone: string | null;
    defaultNote: string | null;
    logoUrl: string | null;
  } | null;
}

type ModalPhase =
  | "loading"
  | "configuring"
  | "rendering"
  | "completed"
  | "failed";

export interface FinalizeVideoModalProps {
  videoGenerationId: string;
  hardinessZone: string | null;
  onClose: () => void;
  /** Called when a render successfully completes — the parent should refetch
   *  the project so the new finalized video card appears on the canvas. */
  onCompleted: (finalizationId: string) => void;
}

function libraryItemToThumbnailUrl(item: LibraryItem): string {
  if (!item.image_path) return "";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-library/${item.image_path}`;
}

export function FinalizeVideoModal({
  videoGenerationId,
  hardinessZone,
  onClose,
  onCompleted,
}: FinalizeVideoModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Asset state — detected from preview vs manually added via the browser.
  const [removedDetectedNames, setRemovedDetectedNames] = useState<Set<string>>(
    new Set()
  );
  const [manualLibraryItems, setManualLibraryItems] = useState<LibraryItem[]>([]);

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [browserOpen, setBrowserOpen] = useState(false);

  // Render lifecycle
  const [finalizationId, setFinalizationId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Mobile takeover — same pattern as Plant Library + Video modal.
  const isMobile = useIsMobile();

  // Floating-panel bounds (drag/resize/maximize).
  const { bounds, maximized, dragHandlers, resizeHandlers, toggleMaximize } =
    useFloatingPanel({
      storageKey: "finalize-video-bounds-v1",
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

  // ----- Fetch preview data on mount -----
  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      try {
        const res = await fetch(
          `/api/finalize-video/preview?videoGenerationId=${encodeURIComponent(videoGenerationId)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Preview failed (${res.status})`);
        }
        const data: PreviewData = await res.json();
        if (cancelled) return;
        setPreviewData(data);
        setNote(data.branding?.defaultNote ?? "");
        setPhase("configuring");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to load");
        setPhase("failed");
      }
    }
    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [videoGenerationId]);

  // Close on Escape (matches the rest of the floating-panel family).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "rendering") {
        if (browserOpen) {
          // Let the browser handle its own escape first.
          return;
        }
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, phase, browserOpen]);

  // ----- Computed assets list (deduped union) -----
  const assets = useMemo(() => {
    if (!previewData) return [];
    const detected = previewData.detectedAssets
      .filter((a) => !removedDetectedNames.has(a.name))
      .map((a) => ({
        name: a.name,
        thumbnailUrl: a.thumbnail_url,
        description: a.description ?? null,
        zoneMin: a.zone_min ?? null,
        zoneMax: a.zone_max ?? null,
        heightMinFt: a.height_min_ft ?? null,
        heightMaxFt: a.height_max_ft ?? null,
        spreadMinFt: a.spread_min_ft ?? null,
        spreadMaxFt: a.spread_max_ft ?? null,
        sunRequirement: a.sun_requirement ?? null,
        waterNeeds: a.water_needs ?? null,
        growthRate: a.growth_rate ?? null,
        maintenanceLevel: a.maintenance_level ?? null,
      }));
    const detectedNames = new Set(detected.map((a) => a.name));
    const manual = manualLibraryItems
      .filter((item) => !detectedNames.has(item.common_name))
      .map((item) => ({
        name: item.common_name,
        thumbnailUrl: libraryItemToThumbnailUrl(item),
        description: item.description ?? null,
        zoneMin: item.zone_min ?? null,
        zoneMax: item.zone_max ?? null,
        heightMinFt: item.height_min_ft ?? null,
        heightMaxFt: item.height_max_ft ?? null,
        spreadMinFt: item.spread_min_ft ?? null,
        spreadMaxFt: item.spread_max_ft ?? null,
        sunRequirement: item.sun_requirement ?? null,
        waterNeeds: item.water_needs ?? null,
        growthRate: item.growth_rate ?? null,
        maintenanceLevel: item.maintenance_level ?? null,
      }));
    return [...detected, ...manual];
  }, [previewData, removedDetectedNames, manualLibraryItems]);

  // ----- Memoized inputProps for the Player preview -----
  const playerProps: FinalizeVideoProps | null = useMemo(() => {
    if (!previewData) return null;
    return {
      veoUrl: previewData.veo.signedUrl,
      veoDurationSeconds: previewData.veo.durationSeconds,
      veoWidth: previewData.veo.width,
      veoHeight: previewData.veo.height,
      assets,
      address: address.trim() || null,
      branding: previewData.branding
        ? {
            logoUrl: previewData.branding.logoUrl,
            companyName: previewData.branding.companyName ?? "",
            companyPhone: previewData.branding.companyPhone,
            note: note.trim() || previewData.branding.defaultNote || null,
          }
        : null,
    };
  }, [previewData, assets, address, note]);

  const playerDuration = useMemo(() => {
    if (!previewData) return 0;
    const veoFrames = Math.round(
      previewData.veo.durationSeconds * COMPOSITION_FPS
    );
    const freezeFrames = FREEZE_HOLD_SECONDS * COMPOSITION_FPS;
    const plantInfoFrames =
      assets.length * PLANT_INFO_SECONDS_PER_ASSET * COMPOSITION_FPS;
    return veoFrames + freezeFrames + plantInfoFrames;
  }, [previewData, assets.length]);

  // ----- Asset chip handlers -----
  const handleRemoveAsset = useCallback(
    (name: string) => {
      if (previewData?.detectedAssets.some((a) => a.name === name)) {
        setRemovedDetectedNames((prev) => {
          const next = new Set(prev);
          next.add(name);
          return next;
        });
      }
      setManualLibraryItems((prev) =>
        prev.filter((i) => i.common_name !== name)
      );
    },
    [previewData]
  );

  // ----- Submit handler -----
  const handleSubmit = useCallback(async () => {
    setErrorMessage(null);
    setPhase("rendering");
    setProgress(0);

    try {
      const res = await fetch("/api/finalize-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoGenerationId,
          assets,
          address: address.trim() || null,
          note: note.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Render failed (${res.status})`);
      }

      // Cache hit: server already has a completed render.
      if (body.cached) {
        setFinalizationId(body.id);
        setProgress(1);
        setPhase("completed");
        const statusRes = await fetch(`/api/finalize-video/${body.id}`);
        const statusBody = await statusRes.json().catch(() => ({}));
        setOutputUrl(statusBody.outputUrl ?? null);
        onCompleted(body.id);
        return;
      }

      setFinalizationId(body.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Render failed");
      setPhase("failed");
    }
  }, [videoGenerationId, assets, address, note, onCompleted]);

  // ----- Poll for status while rendering -----
  const polledOnceRef = useRef(false);
  useEffect(() => {
    if (phase !== "rendering" || !finalizationId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled || !finalizationId) return;
      try {
        const res = await fetch(`/api/finalize-video/${finalizationId}`);
        if (!res.ok) throw new Error(`Status check failed (${res.status})`);
        const body = await res.json();
        if (cancelled) return;

        polledOnceRef.current = true;
        setProgress(body.progress ?? 0);

        if (body.status === "completed") {
          setOutputUrl(body.outputUrl ?? null);
          setPhase("completed");
          onCompleted(finalizationId);
          return;
        }
        if (body.status === "failed") {
          setErrorMessage(body.error ?? "Render failed");
          setPhase("failed");
          return;
        }

        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        console.warn("Poll error:", err);
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [phase, finalizationId, onCompleted]);

  // ----- Plant browser callbacks -----
  const handleBrowserSelectionChange = useCallback((items: LibraryItem[]) => {
    setManualLibraryItems(items);
  }, []);

  const handleBrowserClose = useCallback(() => {
    setBrowserOpen(false);
  }, []);

  const canSubmit =
    phase === "configuring" &&
    previewData !== null &&
    previewData.branding !== null &&
    (assets.length > 0 || address.trim().length > 0);

  const brandingMissing =
    phase !== "loading" && previewData !== null && previewData.branding === null;

  const isRendering = phase === "rendering";
  const isLocked = isRendering;

  // Mobile = fullscreen takeover; desktop = floating panel.
  const panelStyle: React.CSSProperties = isMobile
    ? { left: 0, top: 0, width: "100vw", height: "100dvh", boxShadow: "none" }
    : {
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        boxShadow: "var(--shadow-toolbar)",
      };

  const footerHint =
    phase === "configuring"
      ? "1 credit will be used."
      : phase === "rendering"
        ? "Render in progress — please wait."
        : phase === "completed"
          ? "Done."
          : phase === "failed"
            ? "Render failed."
            : "Loading preview…";

  return (
    <>
      <div
        role="dialog"
        aria-label="Finalize Video"
        className={`fixed z-40 flex flex-col overflow-hidden bg-panel-main ${
          isMobile ? "" : "rounded-lg border border-panel-border"
        }`}
        style={panelStyle}
      >
        {/* Title bar */}
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
            Finalize Video
          </h2>
          <span
            aria-hidden
            className="hidden h-[14px] w-px shrink-0 bg-panel-border sm:block"
          />
          <p className="hidden text-[12px] font-medium text-panel-muted sm:block">
            Add branding + assets to render a polished version
          </p>

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
              if (!isLocked) onClose();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isLocked}
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-panel-subtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body — split: player on left (panel-search bg), form on right (panel-subtle bg) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Left pane — player preview */}
          <div className="flex flex-[3] items-center justify-center overflow-hidden bg-panel-search p-6">
            {phase === "loading" && (
              <div className="flex flex-col items-center gap-3 text-sm text-panel-muted">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading preview…
              </div>
            )}
            {previewData && playerProps && (
              <div
                className="overflow-hidden rounded-md bg-black"
                style={{
                  aspectRatio: `${previewData.veo.width} / ${previewData.veo.height}`,
                  // Fill the pane while preserving aspect ratio:
                  //   height fills the pane, width follows from aspect-ratio,
                  //   and max-width clamps width when the pane is narrower
                  //   than the computed width (aspect-ratio then shrinks height
                  //   to match). Works both when the pane is wider-than-aspect
                  //   and taller-than-aspect, and scales up when maximized.
                  height: "100%",
                  width: "auto",
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
              >
                <Player
                  component={FinalizeVideo}
                  inputProps={playerProps}
                  durationInFrames={playerDuration}
                  compositionWidth={previewData.veo.width}
                  compositionHeight={previewData.veo.height}
                  fps={COMPOSITION_FPS}
                  controls
                  loop={false}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            )}
          </div>

          {/* Vertical divider — desktop only; horizontal divider on mobile */}
          <div className="h-px w-full shrink-0 bg-panel-border md:h-auto md:w-px" />

          {/* Right pane — form / progress / completed / failed */}
          <div
            className="scrollbar-minimal flex flex-[2] min-h-0 flex-col gap-4 overflow-y-auto p-[22px]"
            style={{ backgroundColor: "var(--color-panel-subtle)" }}
          >
            {phase === "loading" && (
              <p className="text-sm text-panel-muted">Loading…</p>
            )}

            {(phase === "configuring" || phase === "rendering") && previewData && (
              <>
                {/* Assets section */}
                <section className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <SectionLabel>ASSETS</SectionLabel>
                    {assets.length > 0 && (
                      <span className="text-[11px] font-medium text-panel-muted">
                        · {assets.length}
                      </span>
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setBrowserOpen(true)}
                      className="cursor-pointer text-[11px] font-semibold text-primary transition-colors hover:text-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      + Add asset
                    </button>
                  </div>
                  {assets.length === 0 ? (
                    <p className="text-[12px] text-panel-muted">
                      None detected from this video&apos;s history. Add some
                      manually.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {assets.map((asset) => (
                        <span
                          key={asset.name}
                          className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-panel-border bg-white py-[3px] pl-1 pr-2 text-[11px] font-semibold text-foreground"
                        >
                          {asset.thumbnailUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={asset.thumbnailUrl}
                              alt={asset.name}
                              className="h-[18px] w-[18px] rounded-full object-cover"
                            />
                          ) : (
                            <span className="h-[18px] w-[18px] rounded-full bg-panel-chip" />
                          )}
                          <span>{asset.name}</span>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleRemoveAsset(asset.name)}
                            className="ml-0.5 cursor-pointer text-panel-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Remove ${asset.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* Property address */}
                <section className="flex flex-col gap-1.5">
                  <SectionLabel hint="optional">PROPERTY ADDRESS</SectionLabel>
                  <input
                    id="finalize-address"
                    type="text"
                    value={address}
                    onChange={(e) =>
                      setAddress(e.target.value.slice(0, ADDRESS_MAX_LENGTH))
                    }
                    disabled={isLocked}
                    placeholder="1234 Maple Avenue, Springfield"
                    maxLength={ADDRESS_MAX_LENGTH}
                    autoComplete="off"
                    className="no-autofill-tint h-9 w-full rounded-lg border border-panel-border bg-white px-3 text-[13px] text-foreground placeholder:text-panel-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </section>

                {/* Closing note */}
                <section className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <SectionLabel>CLOSING NOTE</SectionLabel>
                    <div className="flex-1" />
                    <span className="text-[10px] font-medium text-panel-muted">
                      {note.length}/{NOTE_MAX_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="finalize-note"
                    value={note}
                    onChange={(e) =>
                      setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))
                    }
                    disabled={isLocked}
                    rows={3}
                    placeholder="Contact us today and we can make this happen."
                    maxLength={NOTE_MAX_LENGTH}
                    className="min-h-[64px] w-full resize-none rounded-lg border border-panel-border bg-white px-3 py-2.5 text-[13px] text-foreground placeholder:text-panel-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </section>

                {/* Branding summary */}
                <section className="flex flex-col gap-1.5">
                  <SectionLabel>BRANDING</SectionLabel>
                  {brandingMissing ? (
                    <div className="rounded-lg border border-panel-border bg-white p-3 text-[12px]">
                      <p className="font-semibold text-foreground">
                        Set up your company branding first.
                      </p>
                      <p className="mt-1 text-panel-muted">
                        <a
                          href="/account#branding"
                          className="font-semibold text-primary hover:underline"
                        >
                          Go to Account Settings →
                        </a>
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-[60px] items-center gap-3 rounded-lg border border-panel-border bg-white p-3">
                      {previewData.branding?.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={previewData.branding.logoUrl}
                          alt="Logo"
                          className="h-9 w-9 shrink-0 rounded-md border border-panel-border bg-white object-contain"
                        />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md bg-primary" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold text-foreground">
                          {previewData.branding?.companyName ?? "—"}
                        </span>
                        {previewData.branding?.companyPhone && (
                          <span className="truncate text-[11px] font-medium text-panel-muted">
                            {previewData.branding.companyPhone}
                          </span>
                        )}
                      </div>
                      <a
                        href="/account#branding"
                        className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                      >
                        Edit
                      </a>
                    </div>
                  )}
                </section>

                {/* Render progress */}
                {phase === "rendering" && (
                  <section className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] text-panel-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        Rendering on Lambda…
                      </span>
                      <span className="font-semibold text-foreground">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-panel-border">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.max(2, progress * 100)}%` }}
                      />
                    </div>
                  </section>
                )}
              </>
            )}

            {phase === "completed" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">
                      Finalized video ready
                    </p>
                    <p className="text-[12px] text-panel-muted">
                      Added to your canvas next to the source video.
                    </p>
                  </div>
                </div>
                {outputUrl && (
                  <a
                    href={outputUrl}
                    download
                    className="block cursor-pointer rounded-md bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-white transition-colors hover:bg-primary-light"
                  >
                    Download MP4
                  </a>
                )}
              </div>
            )}

            {phase === "failed" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <svg
                      className="h-5 w-5 text-destructive"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold text-foreground">
                    Finalize failed
                  </p>
                </div>
                <p className="text-[12px] text-panel-muted">
                  {errorMessage ?? "Something went wrong. Please try again."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-[54px] shrink-0 items-center gap-2.5 border-t border-panel-border bg-panel-subtle px-4">
          <p className="text-[12px] font-medium text-panel-muted">{footerHint}</p>
          <div className="flex-1" />
          {phase === "completed" || phase === "failed" ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-[30px] cursor-pointer items-center justify-center rounded-md border border-panel-border bg-white px-3.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:bg-panel-subtle"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => !isLocked && onClose()}
                disabled={isLocked}
                className="flex h-[30px] cursor-pointer items-center justify-center rounded-md border border-panel-border bg-white px-3.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:bg-panel-subtle disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isLocked}
                className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 text-[12px] font-semibold text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SparkleIcon />
                {isRendering ? "Rendering…" : "Render Final Video"}
              </button>
            </>
          )}
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

      {/* Plant browser — floats above this modal at z-50 */}
      {browserOpen && (
        <div className="fixed inset-0 z-50">
          <PlantBrowser
            hardinessZone={hardinessZone}
            selectedItems={manualLibraryItems}
            onSelectionChange={handleBrowserSelectionChange}
            onClose={handleBrowserClose}
          />
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------

function SectionLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="text-[11px] font-bold text-panel-muted"
        style={{ letterSpacing: "0.6px" }}
      >
        {children}
      </span>
      {hint && (
        <span className="text-[11px] font-medium text-panel-muted">
          · {hint}
        </span>
      )}
    </span>
  );
}

function SparkleIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  );
}
