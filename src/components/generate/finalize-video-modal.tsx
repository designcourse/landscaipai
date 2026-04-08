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
} from "../../../remotion/lib/timing";
import type { LibraryItem } from "@/types";
import { PlantBrowser } from "./plant-browser";

const NOTE_MAX_LENGTH = 500;
const ADDRESS_MAX_LENGTH = 200;
const POLL_INTERVAL_MS = 2500;

interface DetectedAsset {
  id: string;
  name: string;
  thumbnail_url: string;
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

  // Asset state — split between auto-detected (from preview) and manually
  // added (from PlantBrowser). The chip list is the deduped union.
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

  // ----- Computed assets list (deduped union) -----
  const assets = useMemo(() => {
    if (!previewData) return [];
    const detected = previewData.detectedAssets
      .filter((a) => !removedDetectedNames.has(a.name))
      .map((a) => ({ name: a.name, thumbnailUrl: a.thumbnail_url }));
    const detectedNames = new Set(detected.map((a) => a.name));
    const manual = manualLibraryItems
      .filter((item) => !detectedNames.has(item.common_name))
      .map((item) => ({
        name: item.common_name,
        thumbnailUrl: libraryItemToThumbnailUrl(item),
      }));
    return [...detected, ...manual];
  }, [previewData, removedDetectedNames, manualLibraryItems]);

  // ----- Memoized inputProps for the Player preview -----
  // Must mirror the shape sent to /api/finalize-video to keep WYSIWYG honest.
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
    return veoFrames + freezeFrames;
  }, [previewData]);

  // ----- Asset chip handlers -----
  const handleRemoveAsset = useCallback(
    (name: string) => {
      // If it was a detected asset, mark it removed
      if (previewData?.detectedAssets.some((a) => a.name === name)) {
        setRemovedDetectedNames((prev) => {
          const next = new Set(prev);
          next.add(name);
          return next;
        });
      }
      // If it was a manually-added one, drop it
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

      // Cache hit: server already has a completed render
      if (body.cached) {
        setFinalizationId(body.id);
        setProgress(1);
        setPhase("completed");
        // Fetch the signed URL via the status endpoint
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

        // Continue polling
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        // On transient error, just keep polling — don't fail the whole render
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

  // ----- Backdrop click should not close during render -----
  const handleBackdropClick = useCallback(() => {
    if (phase === "rendering") return; // Don't allow accidental cancel
    onClose();
  }, [phase, onClose]);

  const canSubmit =
    phase === "configuring" &&
    previewData !== null &&
    previewData.branding !== null &&
    (assets.length > 0 || address.trim().length > 0);

  const brandingMissing =
    phase !== "loading" && previewData !== null && previewData.branding === null;

  return (
    <>
      <div
        className="fixed inset-0 z-[250] flex items-center justify-center"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        onClick={handleBackdropClick}
      >
        <div
          className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg"
          style={{
            backgroundColor: "var(--color-background)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-toolbar)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-6 py-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Finalize Video
                </h2>
                <p className="text-xs text-muted-foreground">
                  Add branding + assets, then render a polished version to send to clients.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={phase === "rendering"}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body — two columns */}
          <div className="grid max-h-[calc(92vh-140px)] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* Left: Player preview */}
            <div className="flex items-center justify-center bg-black p-4">
              {phase === "loading" && (
                <div className="text-sm text-white/60">Loading preview…</div>
              )}
              {previewData && playerProps && (
                <div
                  className="w-full overflow-hidden rounded-md"
                  style={{
                    aspectRatio: `${previewData.veo.width} / ${previewData.veo.height}`,
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

            {/* Right: Form / Progress / Completed / Failed */}
            <div
              className="flex flex-col gap-5 border-l p-6"
              style={{ borderColor: "var(--color-border)" }}
            >
              {phase === "loading" && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}

              {(phase === "configuring" || phase === "rendering") &&
                previewData && (
                  <>
                    {/* Assets section */}
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          Assets
                        </h3>
                        <button
                          type="button"
                          disabled={phase === "rendering"}
                          onClick={() => setBrowserOpen(true)}
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          + Add asset
                        </button>
                      </div>
                      {assets.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No assets — none were detected in this video&apos;s
                          history. Add some manually.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assets.map((asset) => (
                            <div
                              key={asset.name}
                              className="group flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs"
                              style={{ borderColor: "var(--color-border)" }}
                            >
                              {asset.thumbnailUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={asset.thumbnailUrl}
                                  alt={asset.name}
                                  className="h-6 w-6 rounded object-contain"
                                />
                              )}
                              <span className="font-medium text-foreground">
                                {asset.name}
                              </span>
                              <button
                                type="button"
                                disabled={phase === "rendering"}
                                onClick={() => handleRemoveAsset(asset.name)}
                                className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
                                aria-label={`Remove ${asset.name}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Address */}
                    <section className="space-y-2">
                      <label
                        htmlFor="finalize-address"
                        className="block text-sm font-semibold text-foreground"
                      >
                        Property address (optional)
                      </label>
                      <input
                        id="finalize-address"
                        type="text"
                        value={address}
                        onChange={(e) =>
                          setAddress(
                            e.target.value.slice(0, ADDRESS_MAX_LENGTH)
                          )
                        }
                        disabled={phase === "rendering"}
                        placeholder="1234 Maple Avenue, Springfield"
                        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        maxLength={ADDRESS_MAX_LENGTH}
                      />
                      <p className="text-xs text-muted-foreground">
                        Shown in the bottom-left for the duration of the video.
                      </p>
                    </section>

                    {/* Note */}
                    <section className="space-y-2">
                      <label
                        htmlFor="finalize-note"
                        className="block text-sm font-semibold text-foreground"
                      >
                        Closing note (optional)
                      </label>
                      <textarea
                        id="finalize-note"
                        value={note}
                        onChange={(e) =>
                          setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))
                        }
                        disabled={phase === "rendering"}
                        rows={3}
                        placeholder="Contact us today and we can make this happen."
                        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        maxLength={NOTE_MAX_LENGTH}
                      />
                      <p className="text-xs text-muted-foreground">
                        {note.length}/{NOTE_MAX_LENGTH} characters
                      </p>
                    </section>

                    {/* Branding summary */}
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Branding
                      </h3>
                      {brandingMissing ? (
                        <div
                          className="rounded-md border bg-muted p-3 text-xs"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          <p className="font-medium text-foreground">
                            Set up your company branding first.
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            <a
                              href="/account#branding"
                              className="font-medium text-primary hover:underline"
                            >
                              Go to Account Settings →
                            </a>
                          </p>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-3 rounded-md border bg-background p-3"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          {previewData.branding?.logoUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={previewData.branding.logoUrl}
                              alt="Logo"
                              className="h-10 w-10 rounded border object-contain"
                              style={{ borderColor: "var(--color-border)" }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {previewData.branding?.companyName ?? "—"}
                            </p>
                            {previewData.branding?.companyPhone && (
                              <p className="truncate text-xs text-muted-foreground">
                                {previewData.branding.companyPhone}
                              </p>
                            )}
                          </div>
                          <a
                            href="/account#branding"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Edit
                          </a>
                        </div>
                      )}
                    </section>

                    {phase === "rendering" && (
                      <section className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Rendering on Lambda…</span>
                          <span>{Math.round(progress * 100)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <svg
                        className="h-6 w-6 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Finalized video ready
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added to your canvas next to the source video.
                      </p>
                    </div>
                  </div>
                  {outputUrl && (
                    <a
                      href={outputUrl}
                      download
                      className="block rounded-sm bg-primary px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-primary-light"
                    >
                      Download MP4
                    </a>
                  )}
                </div>
              )}

              {phase === "failed" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <svg
                        className="h-6 w-6 text-destructive"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      Finalize failed
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {errorMessage ?? "Something went wrong. Please try again."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="text-xs text-muted-foreground">
              {phase === "configuring" && "1 credit will be used."}
              {phase === "rendering" && "Render in progress — please wait."}
              {phase === "completed" && "Done."}
              {phase === "failed" && "Render failed."}
            </div>
            <div className="flex gap-3">
              {phase === "completed" || phase === "failed" ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={phase === "rendering"}
                    className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-40"
                  >
                    {phase === "rendering" ? "Rendering…" : "Render Final Video"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plant browser — floats above the modal at z-[300] */}
      {browserOpen && (
        <div className="fixed inset-0 z-[300]">
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
