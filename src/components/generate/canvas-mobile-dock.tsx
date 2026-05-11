"use client";

import { useEffect, useRef, useState } from "react";
import {
  STYLE_PRESETS,
  TIME_OF_DAY_OPTIONS,
  SEASON_OPTIONS,
  WEATHER_OPTIONS,
} from "@/lib/gemini/prompts";
import type { LibraryItem } from "@/types";
import type { AttachmentPreview } from "./canvas-bottom-bar";

interface CanvasMobileDockProps {
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
  onOpenLibrary: () => void;
  onOpenVideoModal: () => void;
  videoButtonState: "disabled-no-selection" | "disabled-aspect-mismatch" | "enabled";
  generating: boolean;
  credits: number;
  hasSelection: boolean;
  hasMask: boolean;
  error: string | null;
  selectedLibraryItems: LibraryItem[];
  onRemoveLibraryItem: (id: string) => void;
  onLibraryItemClick: (id: string) => void;
  attachments: AttachmentPreview[];
  onAddAttachmentFiles: (files: FileList) => void;
  onPasteAttachment: (blob: Blob, name: string) => void;
  onRemoveAttachment: (id: string) => void;
  imageModel: "gemini" | "gemini-pro" | "openai";
  onImageModelChange: (model: "gemini" | "gemini-pro" | "openai") => void;
  // Mobile-only callbacks (resolved against the primary selection at the workspace level)
  onEditRegion?: () => void;
  onRequestDelete?: () => void;
}

type Tab = "style" | "settings" | "library" | "prompt" | "generate";

const ACCEPTED_ATTACHMENT_TYPES = "image/jpeg,image/png,image/webp";
const MAX_ATTACHMENTS = 5;

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

const IMAGE_MODEL_OPTIONS: { id: "gemini" | "gemini-pro" | "openai"; label: string; description: string }[] = [
  { id: "gemini", label: "Nano Banana 2", description: "Google Gemini 3.1 Flash Image" },
  { id: "gemini-pro", label: "Nano Banana Pro", description: "Google Gemini 3 Pro Image" },
  { id: "openai", label: "OpenAI Image 2.0", description: "OpenAI gpt-image-2" },
];

export function CanvasMobileDock(props: CanvasMobileDockProps) {
  const [activeTab, setActiveTab] = useState<Tab>("prompt");
  const [panelOpen, setPanelOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelMenuOpen) return;
    function onDown(e: PointerEvent) {
      if (!modelMenuRef.current?.contains(e.target as Node)) setModelMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [modelMenuOpen]);

  function handleTabClick(tab: Tab) {
    if (tab === "library") {
      // Library tab opens the full plant browser overlay directly
      props.onOpenLibrary();
      return;
    }
    if (activeTab === tab && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveTab(tab);
      setPanelOpen(true);
    }
  }

  function handleAttachmentClick() {
    attachmentInputRef.current?.click();
  }

  function handleAttachmentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) props.onAddAttachmentFiles(files);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = cd.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          if (props.attachments.length < MAX_ATTACHMENTS) {
            const ext = file.type.split("/")[1] || "png";
            props.onPasteAttachment(file, file.name || `pasted-image.${ext}`);
          }
          return;
        }
      }
    }
  }

  function shortenName(name: string, max = 18): string {
    if (name.length <= max) return name;
    const dot = name.lastIndexOf(".");
    if (dot === -1 || dot < max - 6) return name.slice(0, max - 1) + "\u2026";
    const ext = name.slice(dot);
    return name.slice(0, max - ext.length - 1) + "\u2026" + ext;
  }

  const styleCategories = STYLE_PRESETS.reduce(
    (acc, preset) => {
      if (!acc[preset.category]) acc[preset.category] = [];
      acc[preset.category].push(preset);
      return acc;
    },
    {} as Record<string, typeof STYLE_PRESETS>
  );

  const selectedPreset = props.style ? STYLE_PRESETS.find((p) => p.id === props.style) : null;
  const canAddMore = props.attachments.length < MAX_ATTACHMENTS;
  const canGenerate =
    !props.generating &&
    props.credits >= 1 &&
    props.hasSelection &&
    (props.hasMask ? props.customPrompt.trim().length > 0 : !!props.style || props.customPrompt.trim().length > 0);
  const generateBlockedReason = !props.hasSelection
    ? "Select an image"
    : props.credits < 1
      ? "Out of credits"
      : props.hasMask && !props.customPrompt.trim()
        ? "Describe the masked area"
        : !props.style && !props.customPrompt.trim()
          ? "Pick a style or write a prompt"
          : null;

  return (
    <>
      <input
        ref={attachmentInputRef}
        type="file"
        accept={ACCEPTED_ATTACHMENT_TYPES}
        multiple
        onChange={handleAttachmentInputChange}
        className="hidden"
      />

      <div
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Error banner */}
        {props.error && (
          <div
            className="mx-3 mb-2 rounded-md px-3 py-2 text-sm"
            style={{
              backgroundColor: "rgba(220, 38, 38, 0.1)",
              color: "var(--color-destructive)",
            }}
          >
            {props.error}
          </div>
        )}

        {/* Selection floating action bar */}
        {props.hasSelection && (
          <div
            className="mx-3 mb-2 flex items-center justify-between rounded-md border border-border bg-white px-2 py-1.5"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            <span className="px-2 text-xs font-medium text-muted-foreground">Selected</span>
            <div className="flex items-center gap-0.5">
              {props.onEditRegion && (
                <button
                  onClick={props.onEditRegion}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
                  aria-label="In-paint"
                  title="In-paint"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {props.videoButtonState === "enabled" && (
                <button
                  onClick={props.onOpenVideoModal}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
                  aria-label="Generate video"
                  title="Generate video"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
              {props.onRequestDelete && (
                <button
                  onClick={props.onRequestDelete}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-destructive transition-colors hover:bg-muted"
                  aria-label="Delete"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contextual panel */}
        {panelOpen && (
          <div
            className="rounded-t-2xl bg-white"
            style={{
              boxShadow: "var(--shadow-toolbar)",
              borderTop: "1px solid var(--color-canvas-input-border)",
              borderLeft: "1px solid var(--color-canvas-input-border)",
              borderRight: "1px solid var(--color-canvas-input-border)",
            }}
          >
            {activeTab === "style" && (
              <StylePanel
                value={props.style}
                onChange={(v) => props.onStyleChange(v)}
                categories={styleCategories}
              />
            )}
            {activeTab === "settings" && (
              <SettingsPanel
                timeOfDay={props.timeOfDay}
                onTimeOfDayChange={props.onTimeOfDayChange}
                season={props.season}
                onSeasonChange={props.onSeasonChange}
                weather={props.weather}
                onWeatherChange={props.onWeatherChange}
              />
            )}
            {activeTab === "prompt" && (
              <PromptPanel
                customPrompt={props.customPrompt}
                onCustomPromptChange={props.onCustomPromptChange}
                hasMask={props.hasMask}
                onPaste={handlePaste}
                textareaRef={textareaRef}
                onAttachmentClick={handleAttachmentClick}
                canAddMore={canAddMore}
                attachmentsCount={props.attachments.length}
                attachments={props.attachments}
                onRemoveAttachment={props.onRemoveAttachment}
                selectedLibraryItems={props.selectedLibraryItems}
                onRemoveLibraryItem={props.onRemoveLibraryItem}
                onLibraryItemClick={props.onLibraryItemClick}
                shortenName={shortenName}
                imageModel={props.imageModel}
                onImageModelChange={props.onImageModelChange}
                modelMenuOpen={modelMenuOpen}
                setModelMenuOpen={setModelMenuOpen}
                modelMenuRef={modelMenuRef}
              />
            )}
            {activeTab === "generate" && (
              <GeneratePanel
                onGenerate={props.onGenerate}
                generating={props.generating}
                canGenerate={canGenerate}
                blockedReason={generateBlockedReason}
                style={props.style}
                styleName={selectedPreset?.name ?? null}
                timeOfDay={props.timeOfDay}
                season={props.season}
                weather={props.weather}
                attachmentsCount={props.attachments.length}
                librarySelectedCount={props.selectedLibraryItems.length}
                customPrompt={props.customPrompt}
              />
            )}
          </div>
        )}

        {/* Tab dock */}
        <div
          className="flex h-16 items-stretch border-t border-border bg-white"
          style={{ borderTopColor: "var(--color-canvas-toolbar-border)" }}
        >
          <DockTab
            id="style"
            label="Style"
            badge={selectedPreset ? "\u2022" : null}
            isActive={activeTab === "style" && panelOpen}
            onClick={() => handleTabClick("style")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="10" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="16" cy="10" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none" />
              </svg>
            }
          />
          <DockTab
            id="settings"
            label="Settings"
            badge={props.timeOfDay || props.season || props.weather ? "\u2022" : null}
            isActive={activeTab === "settings" && panelOpen}
            onClick={() => handleTabClick("settings")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="9" cy="6" r="2" fill="white" />
                <circle cx="15" cy="12" r="2" fill="white" />
                <circle cx="8" cy="18" r="2" fill="white" />
              </svg>
            }
          />
          <DockTab
            id="library"
            label="Library"
            badge={props.selectedLibraryItems.length > 0 ? String(props.selectedLibraryItems.length) : null}
            isActive={false /* opens overlay */}
            onClick={() => handleTabClick("library")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s-7-4-7-12a7 7 0 0114 0c0 8-7 12-7 12z" />
                <path d="M12 14V3" />
              </svg>
            }
          />
          <DockTab
            id="prompt"
            label="Prompt"
            badge={props.customPrompt.trim() ? "\u2022" : null}
            isActive={activeTab === "prompt" && panelOpen}
            onClick={() => handleTabClick("prompt")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            }
          />
          <DockTab
            id="generate"
            label="Generate"
            isActive={activeTab === "generate" && panelOpen}
            onClick={() => handleTabClick("generate")}
            accent
            icon={
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
              </svg>
            }
          />
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Dock tab
// ----------------------------------------------------------------------------
function DockTab({
  id,
  label,
  icon,
  badge,
  isActive,
  onClick,
  accent,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | null;
  isActive: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  const colorClass = isActive
    ? accent
      ? "text-primary"
      : "text-primary"
    : accent
      ? "text-primary-dark"
      : "text-muted-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors ${colorClass}`}
      data-tab={id}
    >
      <span className="relative h-5 w-5 shrink-0">
        {icon}
        {badge && (
          <span
            className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white"
          >
            {badge}
          </span>
        )}
      </span>
      <span className="hidden max-w-full truncate text-[10px] font-semibold uppercase tracking-wider min-[340px]:block">
        {label}
      </span>
      {isActive && (
        <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" />
      )}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Style panel
// ----------------------------------------------------------------------------
function StylePanel({
  value,
  onChange,
  categories,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  categories: Record<string, typeof STYLE_PRESETS>;
}) {
  return (
    <div className="max-h-[44vh] overflow-y-auto p-3 scrollbar-minimal">
      {Object.entries(categories).map(([category, presets]) => (
        <div key={category} className="mb-3 last:mb-0">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((preset) => {
              const selected = value === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onChange(selected ? null : preset.id)}
                  className={`rounded-md border p-2 text-left transition-colors ${
                    selected
                      ? "border-primary text-primary"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                  style={selected ? { backgroundColor: "rgba(15, 128, 0, 0.08)" } : {}}
                >
                  <div className="text-sm font-semibold leading-tight">{preset.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Settings panel — three chip groups
// ----------------------------------------------------------------------------
function SettingsPanel({
  timeOfDay,
  onTimeOfDayChange,
  season,
  onSeasonChange,
  weather,
  onWeatherChange,
}: {
  timeOfDay: string;
  onTimeOfDayChange: (v: string) => void;
  season: string;
  onSeasonChange: (v: string) => void;
  weather: string;
  onWeatherChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <ChipGroup
        label="Time of day"
        options={[...TIME_OF_DAY_OPTIONS]}
        value={timeOfDay}
        onChange={onTimeOfDayChange}
        emojis={TIME_EMOJIS}
      />
      <ChipGroup
        label="Season"
        options={[...SEASON_OPTIONS]}
        value={season}
        onChange={onSeasonChange}
        emojis={SEASON_EMOJIS}
      />
      <ChipGroup
        label="Weather"
        options={[...WEATHER_OPTIONS]}
        value={weather}
        onChange={onWeatherChange}
        emojis={WEATHER_EMOJIS}
      />
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  emojis,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  emojis: Record<string, string>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(selected ? "" : opt)}
              className={`flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors ${
                selected ? "bg-primary text-white" : "text-foreground"
              }`}
              style={!selected ? { backgroundColor: "var(--color-canvas-chip-bg)" } : {}}
            >
              <span>{emojis[opt] ?? ""}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Prompt panel — textarea + paperclip + AI model + chip rows
// ----------------------------------------------------------------------------
function PromptPanel({
  customPrompt,
  onCustomPromptChange,
  hasMask,
  onPaste,
  textareaRef,
  onAttachmentClick,
  canAddMore,
  attachmentsCount,
  attachments,
  onRemoveAttachment,
  selectedLibraryItems,
  onRemoveLibraryItem,
  onLibraryItemClick,
  shortenName,
  imageModel,
  onImageModelChange,
  modelMenuOpen,
  setModelMenuOpen,
  modelMenuRef,
}: {
  customPrompt: string;
  onCustomPromptChange: (v: string) => void;
  hasMask: boolean;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onAttachmentClick: () => void;
  canAddMore: boolean;
  attachmentsCount: number;
  attachments: AttachmentPreview[];
  onRemoveAttachment: (id: string) => void;
  selectedLibraryItems: LibraryItem[];
  onRemoveLibraryItem: (id: string) => void;
  onLibraryItemClick: (id: string) => void;
  shortenName: (name: string, max?: number) => string;
  imageModel: "gemini" | "gemini-pro" | "openai";
  onImageModelChange: (model: "gemini" | "gemini-pro" | "openai") => void;
  modelMenuOpen: boolean;
  setModelMenuOpen: (open: boolean) => void;
  modelMenuRef: React.RefObject<HTMLDivElement | null>;
}) {
  const hasExtras = attachments.length > 0 || selectedLibraryItems.length > 0;
  const currentModel =
    IMAGE_MODEL_OPTIONS.find((o) => o.id === imageModel)?.label ?? imageModel;

  return (
    <div className="flex flex-col gap-2 p-3">
      {hasExtras && (
        <div className="flex flex-wrap gap-1.5">
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
              <span className="max-w-[120px] truncate" title={att.name}>
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
                aria-label={`Remove ${item.common_name}`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={customPrompt}
        onChange={(e) => onCustomPromptChange(e.target.value)}
        onPaste={onPaste}
        placeholder={
          hasMask
            ? "Describe what to change in the masked area..."
            : "Describe your dream yard..."
        }
        rows={3}
        className="w-full resize-none rounded-md border px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        style={{
          backgroundColor: "var(--color-canvas-input-bg)",
          borderColor: "var(--color-canvas-input-border)",
          minHeight: 72,
        }}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={onAttachmentClick}
          disabled={!canAddMore}
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label={canAddMore ? "Attach reference image" : `Max ${MAX_ATTACHMENTS} attachments`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          {attachmentsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {attachmentsCount}
            </span>
          )}
        </button>

        <div ref={modelMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setModelMenuOpen(!modelMenuOpen)}
            className="flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            aria-label={`AI model: ${currentModel}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="max-w-[88px] truncate">{currentModel}</span>
          </button>

          {modelMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
              <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Model
              </div>
              {IMAGE_MODEL_OPTIONS.map((opt) => {
                const selected = imageModel === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onImageModelChange(opt.id);
                      setModelMenuOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                      selected ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
                      {selected ? (
                        <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-border" />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Generate panel — big CTA + status + summary chips
// ----------------------------------------------------------------------------
function GeneratePanel({
  onGenerate,
  generating,
  canGenerate,
  blockedReason,
  style,
  styleName,
  timeOfDay,
  season,
  weather,
  attachmentsCount,
  librarySelectedCount,
  customPrompt,
}: {
  onGenerate: () => void;
  generating: boolean;
  canGenerate: boolean;
  blockedReason: string | null;
  style: string | null;
  styleName: string | null;
  timeOfDay: string;
  season: string;
  weather: string;
  attachmentsCount: number;
  librarySelectedCount: number;
  customPrompt: string;
}) {
  const summaryChips: string[] = [];
  if (style && styleName) summaryChips.push(styleName);
  if (timeOfDay) summaryChips.push(timeOfDay);
  if (season) summaryChips.push(season);
  if (weather) summaryChips.push(weather);
  if (librarySelectedCount > 0) summaryChips.push(`${librarySelectedCount} from library`);
  if (attachmentsCount > 0) summaryChips.push(`${attachmentsCount} reference${attachmentsCount === 1 ? "" : "s"}`);
  if (customPrompt.trim()) summaryChips.push("custom prompt");

  return (
    <div className="space-y-2 p-3">
      <p className="text-xs text-muted-foreground">
        {blockedReason ?? "Ready \u00b7 1 credit will be used"}
      </p>

      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
        </svg>
        {generating ? "Generating..." : "Generate"}
        <span className="font-medium" style={{ color: "#95f788" }}>
          (1 credit)
        </span>
      </button>

      {summaryChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summaryChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-foreground"
              style={{ backgroundColor: "var(--color-canvas-chip-bg)" }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
