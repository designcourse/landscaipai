"use client";

import { useState, useRef } from "react";
import {
  STYLE_PRESETS,
  TIME_OF_DAY_OPTIONS,
  SEASON_OPTIONS,
  WEATHER_OPTIONS,
} from "@/lib/gemini/prompts";
import type { LibraryItem } from "@/types";

export interface AttachmentPreview {
  id: string;
  name: string;
  previewUrl: string;
}

interface CanvasBottomBarProps {
  style: string | null;
  onStyleChange: (style: string | null) => void;
  timeOfDay: string;
  onTimeOfDayChange: (v: string) => void;
  season: string;
  onSeasonChange: (v: string) => void;
  weather: string;
  onWeatherChange: (v: string) => void;
  customPrompt: string;
  onCustomPromptChange: (v: string) => void;
  onGenerate: () => void;
  onBuyMoreCredits: () => void;
  onOpenLibrary: () => void;
  // Video generation
  onOpenVideoModal: () => void;
  videoButtonState:
    | "disabled-not-enough-frames"
    | "disabled-no-selection"
    | "disabled-aspect-mismatch"
    | "enabled";
  generating: boolean;
  credits: number;
  hasSelection: boolean;
  hasMask: boolean;
  error: string | null;
  selectedLibraryItems: LibraryItem[];
  onRemoveLibraryItem: (id: string) => void;
  onLibraryItemClick: (id: string) => void;
  promptCollapsed: boolean;
  // Attachments
  attachments: AttachmentPreview[];
  onAddAttachmentFiles: (files: FileList) => void;
  onPasteAttachment: (blob: Blob, name: string) => void;
  onRemoveAttachment: (id: string) => void;
  // AI model picker
  imageModel: "gemini" | "gemini-pro" | "openai";
  onImageModelChange: (model: "gemini" | "gemini-pro" | "openai") => void;
}

const IMAGE_MODEL_OPTIONS: { id: "gemini" | "gemini-pro" | "openai"; label: string; description: string }[] = [
  { id: "gemini", label: "Nano Banana 2", description: "Google Gemini 3.1 Flash Image" },
  { id: "gemini-pro", label: "Nano Banana Pro", description: "Google Gemini 3 Pro Image" },
  { id: "openai", label: "OpenAI Image 2.0", description: "OpenAI gpt-image-2" },
];

// Accepted file types for reference attachments
const ACCEPTED_ATTACHMENT_TYPES = "image/jpeg,image/png,image/webp";
const MAX_ATTACHMENTS = 5;

// Cycle through options array: current → next → (none) → first → ...
function cycleOption(current: string, options: readonly string[]): string {
  if (!current) return options[0];
  const idx = options.indexOf(current);
  if (idx === -1 || idx === options.length - 1) return ""; // reset
  return options[idx + 1];
}

// Emoji map for settings
const TIME_EMOJIS: Record<string, string> = {
  Morning: "\u2600\uFE0F",
  Afternoon: "\u2600\uFE0F",
  "Golden Hour": "\uD83C\uDF05",
  Evening: "\uD83C\uDF19",
  Night: "\uD83C\uDF19",
};
const SEASON_EMOJIS: Record<string, string> = {
  Spring: "\uD83C\uDF38",
  Summer: "\uD83C\uDF3F",
  Fall: "\uD83C\uDF42",
  Winter: "\u2744\uFE0F",
};
const WEATHER_EMOJIS: Record<string, string> = {
  Sunny: "\u2600\uFE0F",
  "Partly Cloudy": "\u26C5",
  Overcast: "\u2601\uFE0F",
  Rainy: "\uD83C\uDF27\uFE0F",
  Snowy: "\u2744\uFE0F",
  Foggy: "\uD83C\uDF2B\uFE0F",
};

export function CanvasBottomBar({
  style,
  onStyleChange,
  timeOfDay,
  onTimeOfDayChange,
  season,
  onSeasonChange,
  weather,
  onWeatherChange,
  customPrompt,
  onCustomPromptChange,
  onGenerate,
  onBuyMoreCredits,
  onOpenLibrary,
  onOpenVideoModal,
  videoButtonState,
  generating,
  credits,
  hasSelection,
  hasMask,
  error,
  selectedLibraryItems,
  onRemoveLibraryItem,
  onLibraryItemClick,
  promptCollapsed,
  attachments,
  onAddAttachmentFiles,
  onPasteAttachment,
  onRemoveAttachment,
  imageModel,
  onImageModelChange,
}: CanvasBottomBarProps) {
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  // Model picker UI is currently hidden — `imageModel` is locked to "gemini"
  // by the workspace. Keep all model props/wiring intact so we can flip the
  // picker back on later without rewiring.
  void imageModel;
  void onImageModelChange;

  // When promptCollapsed is set externally, blur the textarea
  const promptExpanded = promptFocused && !promptCollapsed;

  const selectedPreset = style ? STYLE_PRESETS.find((p) => p.id === style) : null;

  // Group presets by category
  const categories = STYLE_PRESETS.reduce(
    (acc, preset) => {
      if (!acc[preset.category]) acc[preset.category] = [];
      acc[preset.category].push(preset);
      return acc;
    },
    {} as Record<string, typeof STYLE_PRESETS>
  );

  const canAddMore = attachments.length < MAX_ATTACHMENTS;

  // Handle paste on textarea — intercept image data from clipboard
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Primary path: clipboardData.files (most reliable for Ctrl+V after navigator.clipboard.write)
    const files = clipboardData.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          if (canAddMore) {
            const ext = file.type.split("/")[1] || "png";
            onPasteAttachment(file, file.name || `pasted-image.${ext}`);
          }
          return;
        }
      }
    }

    // Fallback: clipboardData.items
    const items = clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          e.preventDefault();
          if (canAddMore) {
            const blob = item.getAsFile();
            if (blob) {
              const ext = item.type.split("/")[1] || "png";
              onPasteAttachment(blob, `pasted-image.${ext}`);
            }
          }
          return;
        }
      }
    }
  }

  function handleAttachmentClick() {
    attachmentInputRef.current?.click();
  }

  function handleAttachmentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAddAttachmentFiles(files);
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  const hasExtras = selectedLibraryItems.length > 0 || attachments.length > 0;

  // Shorten long filenames for display in tags
  function shortenName(name: string, max = 18): string {
    if (name.length <= max) return name;
    const dot = name.lastIndexOf(".");
    if (dot === -1 || dot < max - 6) return name.slice(0, max - 1) + "\u2026";
    const ext = name.slice(dot);
    return name.slice(0, max - ext.length - 1) + "\u2026" + ext;
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 pb-6 pointer-events-none">
      {/* Error message */}
      {error && (
        <div className="pointer-events-auto rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Main bottom bar */}
      <div className="pointer-events-auto flex items-end gap-[11px]">
        {/* Options Panel */}
        <div
          className="relative flex items-center gap-3 overflow-visible rounded-[20px] px-5 py-3"
          style={{
            backgroundColor: "var(--color-canvas-card-bg)",
            boxShadow: "var(--shadow-toolbar)",
          }}
        >
          {/* Quick Styles Dropdown */}
          <div className="relative" ref={styleDropdownRef}>
            <button
              onClick={() => setStyleDropdownOpen(!styleDropdownOpen)}
              className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3.5 py-2"
              style={{
                backgroundColor: "var(--color-canvas-input-bg)",
                borderColor: "var(--color-canvas-input-border)",
              }}
            >
              <span className="text-sm">
                <span className="font-semibold text-foreground">Quick Styles </span>
                <span className="font-normal text-foreground">
                  ({selectedPreset?.name ?? "None"})
                </span>
              </span>
              <span className="text-xs text-muted-foreground">&#9662;</span>
            </button>

            {/* Style dropdown popover */}
            {styleDropdownOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-white p-3 shadow-lg"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {Object.entries(categories).map(([category, presets]) => (
                  <div key={category} className="mb-3 last:mb-0">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{category}</p>
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          onStyleChange(style === preset.id ? null : preset.id);
                          setStyleDropdownOpen(false);
                        }}
                        className={`mb-0.5 w-full rounded-md px-3 py-2 text-left transition-colors ${
                          style === preset.id
                            ? "bg-primary/10 text-primary ring-1 ring-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="block text-sm font-medium">{preset.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="h-6 w-px" style={{ backgroundColor: "var(--color-canvas-separator)" }} />

          {/* Time of Day */}
          <button
            onClick={() => onTimeOfDayChange(cycleOption(timeOfDay, TIME_OF_DAY_OPTIONS))}
            className="flex h-10 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5"
            style={{ backgroundColor: "var(--color-canvas-chip-bg)" }}
          >
            <span className="text-xs text-muted-foreground">
              {TIME_EMOJIS[timeOfDay] || "\u2600\uFE0F"}
            </span>
            <span className="text-sm font-medium text-foreground">
              {timeOfDay || "Time"}
            </span>
          </button>

          {/* Season */}
          <button
            onClick={() => onSeasonChange(cycleOption(season, SEASON_OPTIONS))}
            className="flex h-10 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5"
            style={{ backgroundColor: "var(--color-canvas-chip-bg)" }}
          >
            <span className="text-xs text-muted-foreground">
              {SEASON_EMOJIS[season] || "\uD83C\uDF3F"}
            </span>
            <span className="text-sm font-medium text-foreground">
              {season || "Season"}
            </span>
          </button>

          {/* Weather */}
          <button
            onClick={() => onWeatherChange(cycleOption(weather, WEATHER_OPTIONS))}
            className="flex h-10 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5"
            style={{ backgroundColor: "var(--color-canvas-chip-bg)" }}
          >
            <span className="text-xs text-muted-foreground">
              {WEATHER_EMOJIS[weather] || "\u2601\uFE0F"}
            </span>
            <span className="text-sm font-medium text-foreground">
              {weather || "Weather"}
            </span>
          </button>

          {/* Separator */}
          <div className="h-6 w-px" style={{ backgroundColor: "var(--color-canvas-separator)" }} />

          {/* Library Button */}
          <button
            onClick={onOpenLibrary}
            className="flex h-10 items-center gap-1 whitespace-nowrap rounded-[10px] px-2.5 py-2"
            style={{ backgroundColor: "var(--color-canvas-chip-bg)" }}
          >
            <span className="text-xs">{"\uD83C\uDF31"}</span>
            <span className="text-sm font-medium text-foreground">Library</span>
          </button>

          {/* Video Button — enabled only when exactly 2 same-aspect-ratio images are selected */}
          <VideoButton state={videoButtonState} onClick={onOpenVideoModal} />
        </div>

        {/* Prompt Panel */}
        <div
          className="flex w-[405px] flex-col rounded-[20px] px-[13px] py-3"
          style={{
            backgroundColor: "var(--color-canvas-card-bg)",
            boxShadow: "var(--shadow-toolbar)",
          }}
        >
          {/* Textarea row with attachment button */}
          <div className="flex items-start gap-2">
            {/* Attachment button */}
            <button
              onClick={handleAttachmentClick}
              disabled={!canAddMore}
              className="relative mt-[7px] flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title={canAddMore ? "Attach reference images (Ctrl+V to paste)" : `Max ${MAX_ATTACHMENTS} attachments`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {attachments.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {attachments.length}
                </span>
              )}
            </button>

            {/* Hidden file input for attachments */}
            <input
              ref={attachmentInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              multiple
              onChange={handleAttachmentInputChange}
              className="hidden"
            />

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={customPrompt}
                onChange={(e) => onCustomPromptChange(e.target.value)}
                onFocus={() => setPromptFocused(true)}
                onBlur={() => setPromptFocused(false)}
                onPaste={handlePaste}
                placeholder={hasMask ? "Describe what to change in the masked area..." : "Custom instructions (Ctrl+V to paste images)"}
                className="w-full resize-none rounded-[10px] border py-2 px-3.5 text-base text-foreground placeholder:text-[#74716d] focus:outline-none"
                style={{
                  backgroundColor: "var(--color-canvas-input-bg)",
                  borderColor: "var(--color-canvas-input-border)",
                  height: promptExpanded ? 120 : 40,
                  transition: "height 0.2s ease",
                  overflow: promptExpanded ? "auto" : "hidden",
                  lineHeight: "21px",
                }}
                rows={1}
              />
            </div>
          </div>

          {/* Tag row — attachments + library items (inline) */}
          {hasExtras && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {/* Reference attachment tags */}
              {attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs font-medium text-foreground"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                  <span className="max-w-[140px] truncate" title={att.name}>
                    {shortenName(att.name)}
                  </span>
                  <button
                    onClick={() => onRemoveAttachment(att.id)}
                    className="ml-0.5 rounded-full hover:bg-black/10"
                    aria-label={`Remove ${att.name}`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}

              {/* Selected library item tags */}
              {selectedLibraryItems.map((item) => (
                <span
                  key={item.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.item_type === "plant"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <button
                    onClick={() => onLibraryItemClick(item.id)}
                    className="cursor-pointer hover:underline"
                  >
                    {item.common_name}
                  </button>
                  <button
                    onClick={() => onRemoveLibraryItem(item.id)}
                    className="ml-0.5 rounded-full hover:bg-black/10"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Generate CTA — primary green container so it reads as THE primary action.
            When the user is out of credits, swap to a "Buy more credits" CTA that
            opens the purchase modal directly instead of showing a dead Generate button. */}
        <div
          className="flex items-center justify-center overflow-hidden rounded-[20px] bg-primary px-[11px] py-3 transition-colors hover:bg-primary-light"
          style={{ boxShadow: "var(--shadow-toolbar)" }}
        >
          {credits < 1 && !generating ? (
            <button
              onClick={onBuyMoreCredits}
              className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap px-5 py-2.5 text-base font-semibold text-white"
            >
              <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8m5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Buy more credits
            </button>
          ) : (
            <button
              onClick={onGenerate}
              disabled={generating || !hasSelection}
              className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap px-5 py-2.5 text-base font-semibold text-white disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/leaf-mark-white.png"
                alt=""
                aria-hidden
                className="h-[22px] w-[22px]"
              />
              {generating ? (
                "Generating..."
              ) : (
                <>
                  Generate
                  <span className="font-medium" style={{ color: "#95f788" }}>
                    {" "}(1 credit)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Video button — disabled until exactly 2 same-aspect-ratio images are selected.
// Shows a tooltip on hover describing why it is disabled.
// ----------------------------------------------------------------------------
function VideoButton({
  state,
  onClick,
}: {
  state:
    | "disabled-not-enough-frames"
    | "disabled-no-selection"
    | "disabled-aspect-mismatch"
    | "enabled";
  onClick: () => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const disabled = state !== "enabled";

  const tooltipText =
    state === "disabled-not-enough-frames"
      ? "Need 2 images on the canvas"
      : state === "disabled-no-selection"
        ? "Select 2 images"
        : state === "disabled-aspect-mismatch"
          ? "Images must match aspect ratio"
          : "";

  return (
    <div
      className="relative"
      onMouseEnter={() => disabled && setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
    >
      <button
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled}
        className={`flex h-10 items-center gap-1 whitespace-nowrap rounded-[10px] px-2.5 py-2 transition-opacity ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        style={{ backgroundColor: "var(--color-canvas-chip-bg)" }}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: "var(--color-foreground)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span className="text-sm font-medium text-foreground">Video</span>
      </button>

      {tooltipOpen && tooltipText && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
        >
          {tooltipText}
          <div
            className="absolute left-1/2 top-full -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid rgba(0, 0, 0, 0.85)",
            }}
          />
        </div>
      )}
    </div>
  );
}
