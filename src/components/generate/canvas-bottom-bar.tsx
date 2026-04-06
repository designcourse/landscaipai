"use client";

import { useState, useRef } from "react";
import {
  STYLE_PRESETS,
  TIME_OF_DAY_OPTIONS,
  SEASON_OPTIONS,
  WEATHER_OPTIONS,
} from "@/lib/gemini/prompts";
import type { LibraryItem } from "@/types";

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
  onOpenLibrary: () => void;
  generating: boolean;
  credits: number;
  hasSelection: boolean;
  hasMask: boolean;
  error: string | null;
  selectedLibraryItems: LibraryItem[];
  onRemoveLibraryItem: (id: string) => void;
  onLibraryItemClick: (id: string) => void;
  promptCollapsed: boolean;
}

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
  onOpenLibrary,
  generating,
  credits,
  hasSelection,
  hasMask,
  error,
  selectedLibraryItems,
  onRemoveLibraryItem,
  onLibraryItemClick,
  promptCollapsed,
}: CanvasBottomBarProps) {
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        </div>

        {/* Prompt Panel */}
        <div
          className="flex w-[405px] flex-col overflow-hidden rounded-[20px] px-[13px] py-3"
          style={{
            backgroundColor: "var(--color-canvas-card-bg)",
            boxShadow: "var(--shadow-toolbar)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            onFocus={() => setPromptFocused(true)}
            onBlur={() => setPromptFocused(false)}
            placeholder={hasMask ? "Describe what to change in the masked area..." : "Custom instructions"}
            className="w-full resize-none rounded-[10px] border px-3.5 py-2 text-base text-foreground placeholder:text-[#74716d] focus:outline-none"
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

          {/* Selected library items — inside prompt container */}
          {selectedLibraryItems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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

        {/* Generate CTA */}
        <div
          className="flex items-center justify-center overflow-hidden rounded-[20px] px-[11px] py-3"
          style={{
            backgroundColor: "var(--color-canvas-card-bg)",
            boxShadow: "var(--shadow-toolbar)",
          }}
        >
          <button
            onClick={onGenerate}
            disabled={generating || credits < 1 || !hasSelection}
            className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-primary px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            <svg className="h-[19px] w-[19px]" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                fill="currentColor"
              />
            </svg>
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
        </div>
      </div>
    </div>
  );
}
