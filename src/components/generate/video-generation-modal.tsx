"use client";

import { useMemo, useState } from "react";
import {
  CAMERA_PRESETS,
  TRANSITION_PRESETS,
  VIDEO_MODELS,
  RESOLUTION_OPTIONS,
  DEFAULT_CAMERA_PRESET_ID,
  DEFAULT_TRANSITION_PRESET_ID,
  DEFAULT_VIDEO_MODEL_ID,
  DEFAULT_RESOLUTION,
  computeCreditCost,
  type ResolutionOption,
} from "@/lib/gemini/video-prompts";

export interface VideoGenerationSubmit {
  modelId: string;
  cameraPresetId: string;
  transitionPresetId: string;
  resolution: ResolutionOption;
  customPrompt: string;
  // True when the user clicked the swap button — start and end frames should
  // be flipped relative to the original selection order before submitting.
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

const DURATION_SECONDS = 8;

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
  const [cameraPresetId, setCameraPresetId] = useState<string>(DEFAULT_CAMERA_PRESET_ID);
  const [transitionPresetId, setTransitionPresetId] = useState<string>(
    DEFAULT_TRANSITION_PRESET_ID
  );
  const [resolution, setResolution] = useState<ResolutionOption>(DEFAULT_RESOLUTION);
  const [customPrompt, setCustomPrompt] = useState("");
  // Local swap toggle — does not affect the parent's selection order, only
  // determines which frame is shown as Start vs End and how submit is sent.
  const [swapped, setSwapped] = useState(false);

  const cost = useMemo(
    () => computeCreditCost({ modelId, durationSeconds: DURATION_SECONDS, resolution }),
    [modelId, resolution]
  );

  const insufficient = credits < cost;

  function handleSubmit() {
    if (submitting || insufficient) return;
    onSubmit({
      modelId,
      cameraPresetId,
      transitionPresetId,
      resolution,
      customPrompt,
      swapped,
    });
  }

  // Display order — flip when the user has clicked swap
  const displayStart = swapped ? endFrame : startFrame;
  const displayEnd = swapped ? startFrame : endFrame;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={() => !submitting && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg"
        style={{
          backgroundColor: "var(--color-background)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-toolbar)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Generate Video
              </h3>
              <p className="text-xs text-muted-foreground">
                Interpolate between your two selected images
              </p>
            </div>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Frame previews with swap control */}
          <div className="relative grid grid-cols-2 gap-4">
            <FrameCard label="Start Frame" frame={displayStart} />
            <FrameCard label="End Frame" frame={displayEnd} />

            {/* Swap button — sits in the gap between the two frames */}
            <button
              type="button"
              onClick={() => setSwapped((prev) => !prev)}
              title="Swap start and end frames"
              aria-label="Swap start and end frames"
              className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-border transition-shadow hover:shadow-xl"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#1a1a1a"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>
          </div>

          {/* Model */}
          <Section title="Model">
            <div className="grid grid-cols-2 gap-2">
              {VIDEO_MODELS.map((m) => {
                const modelCost = computeCreditCost({
                  modelId: m.id,
                  durationSeconds: DURATION_SECONDS,
                  resolution,
                });
                return (
                  <OptionCard
                    key={m.id}
                    selected={modelId === m.id}
                    title={m.name}
                    description={m.description}
                    badge={`${modelCost} cr`}
                    onClick={() => setModelId(m.id)}
                  />
                );
              })}
            </div>
          </Section>

          {/* Camera Movement */}
          <Section title="Camera Movement">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CAMERA_PRESETS.map((p) => (
                <OptionCard
                  key={p.id}
                  selected={cameraPresetId === p.id}
                  title={p.name}
                  description={p.description}
                  compact
                  onClick={() => setCameraPresetId(p.id)}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Camera movement works best when your start and end frames are taken from
              slightly different vantage points. If both frames are framed identically,
              the movement may be subtle or barely visible — use Stationary in that case.
            </p>
          </Section>

          {/* Transition */}
          <Section title="Transition Style">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRANSITION_PRESETS.map((p) => (
                <OptionCard
                  key={p.id}
                  selected={transitionPresetId === p.id}
                  title={p.name}
                  description={p.description}
                  badge={p.experimental ? "EXPERIMENTAL" : undefined}
                  compact
                  onClick={() => setTransitionPresetId(p.id)}
                />
              ))}
            </div>
          </Section>

          {/* Resolution + audio */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="Resolution">
              <div className="grid grid-cols-2 gap-2">
                {RESOLUTION_OPTIONS.map((r) => (
                  <OptionCard
                    key={r.id}
                    selected={resolution === r.id}
                    title={r.label}
                    description={r.description}
                    compact
                    onClick={() => setResolution(r.id)}
                  />
                ))}
              </div>
            </Section>

            <Section title="Duration">
              <div
                className="flex h-full items-center justify-center rounded-md border px-4 py-3 text-sm text-foreground"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-muted)",
                }}
              >
                <span className="font-medium">8 seconds</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  (required for first/last frame)
                </span>
              </div>
            </Section>
          </div>

          {/* Custom direction */}
          <Section title="Additional Direction (optional)">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. emphasize water reflections, keep sky dramatic, birds flying..."
              rows={2}
              className="w-full resize-none rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-background)",
              }}
            />
          </Section>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="text-sm text-muted-foreground">
            Cost: <span className="font-semibold text-foreground">{cost} credits</span>
            {" · "}
            You have <span className="font-semibold text-foreground">{credits}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                color: "var(--color-foreground)",
                backgroundColor: "var(--color-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || insufficient}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {submitting
                ? "Starting..."
                : insufficient
                  ? "Insufficient credits"
                  : `Generate Video (${cost} credits)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function FrameCard({ label, frame }: { label: string; frame: FramePreview }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div
        className="relative overflow-hidden rounded-md"
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.url}
          alt={label}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    </div>
  );
}

function OptionCard({
  selected,
  title,
  description,
  badge,
  compact,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  badge?: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border text-left transition-all ${
        compact ? "px-3 py-2" : "px-3.5 py-3"
      } ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-background hover:border-foreground/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`font-semibold text-foreground ${compact ? "text-sm" : "text-sm"}`}>
          {title}
        </span>
        {badge && (
          <span
            className="flex-shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {badge}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-muted-foreground ${compact ? "text-xs" : "text-xs"}`}>
        {description}
      </p>
    </button>
  );
}
