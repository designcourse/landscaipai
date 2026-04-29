"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  STYLE_PRESETS,
  TIME_OF_DAY_OPTIONS,
  SEASON_OPTIONS,
  WEATHER_OPTIONS,
} from "@/lib/gemini/prompts";
import { InpaintCanvas } from "./inpaint-canvas";
import { PlantBrowser } from "./plant-browser";
import type { Image, Generation, LibraryItem } from "@/types";

type GenerationWithUrl = Generation & { url: string };

interface GenerationWorkspaceProps {
  image: Image;
  originalImageUrl: string;
  projectId: string;
  projectName: string;
  initialGenerations: GenerationWithUrl[];
  creditsBalance: number;
  hardinessZone?: string | null;
}

export function GenerationWorkspace({
  image,
  originalImageUrl,
  projectId,
  projectName,
  initialGenerations,
  creditsBalance: initialCredits,
  hardinessZone,
}: GenerationWorkspaceProps) {
  const [generations, setGenerations] =
    useState<GenerationWithUrl[]>(initialGenerations);
  const [credits, setCredits] = useState(initialCredits);

  // Current image state: show latest generation or original
  const latestGeneration = generations[generations.length - 1] ?? null;
  const [activeImage, setActiveImage] = useState<{
    url: string;
    label: string;
    generationId: string | null;
  }>({
    url: latestGeneration?.url || originalImageUrl,
    label: latestGeneration ? "Generated result" : "Original photo",
    generationId: latestGeneration?.id ?? null,
  });

  // Form state
  const [style, setStyle] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [season, setSeason] = useState("");
  const [weather, setWeather] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-painting state
  const [inpaintMode, setInpaintMode] = useState(false);
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [rawMaskBase64, setRawMaskBase64] = useState<string | null>(null);

  // Plant browser state
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedLibraryItems, setSelectedLibraryItems] = useState<LibraryItem[]>([]);
  const [browserFocusId, setBrowserFocusId] = useState<string | null>(null);

  // Clear mask when active image changes (use identity, not URL which can change on refresh)
  useEffect(() => {
    setMaskBase64(null);
    setRawMaskBase64(null);
    setInpaintMode(false);
  }, [activeImage.generationId]);

  function handleStartOver() {
    setActiveImage({
      url: originalImageUrl,
      label: "Original photo",
      generationId: null,
    });
  }

  function selectGeneration(gen: GenerationWithUrl) {
    setActiveImage({
      url: gen.url,
      label: "Generated result",
      generationId: gen.id,
    });
  }

  function handleMaskConfirm(overlayDataUrl: string, rawMaskDataUrl: string) {
    setMaskBase64(overlayDataUrl.replace(/^data:image\/\w+;base64,/, ""));
    setRawMaskBase64(rawMaskDataUrl.replace(/^data:image\/\w+;base64,/, ""));
    setInpaintMode(false);
  }

  function handleMaskCancel() {
    setInpaintMode(false);
  }

  function handleClearMask() {
    setMaskBase64(null);
    setRawMaskBase64(null);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;

    // Validation
    if (maskBase64) {
      if (!customPrompt.trim()) {
        setError(
          "Enter a prompt describing what to change in the selected area."
        );
        return;
      }
    } else {
      if (!style && !customPrompt.trim()) {
        setError("Select a style or enter a custom prompt.");
        return;
      }
    }

    setError(null);
    setGenerating(true);

    try {
      const endpoint = maskBase64 ? "/api/generate/inpaint" : "/api/generate";
      const selectedPlants = selectedLibraryItems
        .filter((i) => i.item_type === "plant")
        .map((i) => ({ common_name: i.common_name, scientific_name: i.scientific_name, image_path: i.image_path }));
      const selectedHardscape = selectedLibraryItems
        .filter((i) => i.item_type === "hardscape")
        .map((i) => ({ common_name: i.common_name, image_path: i.image_path }));

      const payload: Record<string, unknown> = {
        imageId: image.id,
        projectId,
        style,
        timeOfDay: timeOfDay || undefined,
        season: season || undefined,
        weather: weather || undefined,
        customPrompt: customPrompt.trim() || undefined,
        parentGenerationId: activeImage.generationId || undefined,
        selectedPlants: selectedPlants.length > 0 ? selectedPlants : undefined,
        selectedHardscape: selectedHardscape.length > 0 ? selectedHardscape : undefined,
      };

      if (maskBase64) {
        payload.maskOverlayBase64 = maskBase64;
        payload.rawMaskBase64 = rawMaskBase64;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "NO_CREDITS") {
          setError(
            "You're out of credits. Visit the pricing page to get more."
          );
        } else {
          setError(data.error || "Generation failed. Please try again.");
        }
        return;
      }

      const newGen: GenerationWithUrl = {
        id: data.generation.id,
        image_id: data.generation.image_id,
        user_id: "",
        parent_generation_id: activeImage.generationId,
        storage_path: "",
        prompt: data.generation.prompt,
        custom_prompt: data.generation.custom_prompt ?? null,
        selected_library_items: data.generation.selected_library_items ?? null,
        style_preset: data.generation.style_preset,
        time_of_day: data.generation.time_of_day,
        season: data.generation.season,
        weather: data.generation.weather,
        is_inpaint: !!maskBase64,
        input_tokens: null,
        output_tokens: null,
        generation_cost_cents: null,
        status: "completed",
        error_message: null,
        created_at: new Date().toISOString(),
        image_model: data.generation.image_model ?? null,
        url: data.generation.url,
      };

      setGenerations((prev) => [...prev, newGen]);
      setActiveImage({
        url: newGen.url,
        label: "Generated result",
        generationId: newGen.id,
      });
      setCredits(data.credits_remaining);
      setMaskBase64(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

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
    <div className="space-y-6">
      {/* In-painting canvas overlay */}
      {inpaintMode && (
        <InpaintCanvas
          imageUrl={activeImage.url}
          onConfirm={handleMaskConfirm}
          onCancel={handleMaskCancel}
        />
      )}

      {/* Plant browser slide-over */}
      {browserOpen && (
        <PlantBrowser
          hardinessZone={hardinessZone ?? null}
          selectedItems={selectedLibraryItems}
          onSelectionChange={setSelectedLibraryItems}
          onClose={() => { setBrowserOpen(false); setBrowserFocusId(null); }}
          focusItemId={browserFocusId}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; {projectName}
          </Link>
          <h1 className="mt-1 text-xl font-bold text-foreground">
            Generate Design
          </h1>
        </div>
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
          {credits} credits
        </span>
      </div>

      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Image display */}
        <div className="space-y-4">
          {/* Active image */}
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            {generating ? (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4">
                <svg
                  className="h-10 w-10 animate-spin text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <p className="text-sm font-medium text-foreground">
                  {maskBase64
                    ? "Applying changes to selected area..."
                    : "Generating your landscape design..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  This usually takes 10-30 seconds
                </p>
              </div>
            ) : (
              <img
                src={activeImage.url}
                alt={activeImage.label}
                className="w-full object-contain"
              />
            )}
          </div>

          {/* Image label + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {activeImage.label}
              </p>
              {maskBase64 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <svg
                    className="h-3 w-3"
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
                  Mask active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {maskBase64 ? (
                <button
                  onClick={handleClearMask}
                  className="text-sm text-destructive transition-colors hover:text-destructive/80"
                >
                  Clear mask
                </button>
              ) : (
                <button
                  onClick={() => setInpaintMode(true)}
                  disabled={generating}
                  className="text-sm text-primary transition-colors hover:text-primary-light disabled:opacity-50"
                >
                  Edit Region
                </button>
              )}
              {activeImage.generationId && (
                <button
                  onClick={handleStartOver}
                  className="text-sm text-primary transition-colors hover:text-primary-light"
                >
                  Start over with original
                </button>
              )}
            </div>
          </div>

          {/* Generation history thumbnails */}
          {generations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                History
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {/* Original thumbnail */}
                <button
                  onClick={handleStartOver}
                  className={`shrink-0 overflow-hidden rounded-md border-2 ${
                    !activeImage.generationId
                      ? "border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <img
                    src={originalImageUrl}
                    alt="Original"
                    className="h-16 w-20 object-cover"
                  />
                </button>

                {generations.map((gen) => (
                  <button
                    key={gen.id}
                    onClick={() => selectGeneration(gen)}
                    className={`relative shrink-0 overflow-hidden rounded-md border-2 ${
                      activeImage.generationId === gen.id
                        ? "border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={gen.url}
                      alt="Generation"
                      className="h-16 w-20 object-cover"
                    />
                    {gen.is_inpaint && (
                      <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-primary/80 px-1 py-0.5 text-[10px] font-medium leading-none text-white">
                        edit
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings panel */}
        <form onSubmit={handleGenerate} className="space-y-5">
          {/* Style preset selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Style
            </label>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-border p-3">
              {Object.entries(categories).map(([category, presets]) => (
                <div key={category}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setStyle(style === preset.id ? null : preset.id)
                        }
                        className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                          style === preset.id
                            ? "bg-primary/10 text-primary ring-1 ring-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {preset.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Time of Day
              </label>
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Any</option>
                {TIME_OF_DAY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Season
              </label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Any</option>
                {SEASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Weather
              </label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Any</option>
                {WEATHER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {maskBase64 ? "Edit Prompt" : "Custom Prompt"}
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={
                maskBase64
                  ? "Describe what to change in the selected area... e.g., 'Replace with a stone walkway bordered by lavender'"
                  : "Add specific requests... e.g., 'Add a stone walkway to the front door with lavender borders'"
              }
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {maskBase64 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Your prompt will be applied only to the masked area.
                Environment settings apply globally.
              </p>
            )}
          </div>

          {/* Selected library items */}
          {selectedLibraryItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
                    type="button"
                    onClick={() => {
                      setBrowserFocusId(item.id);
                      setBrowserOpen(true);
                    }}
                    className="cursor-pointer hover:underline"
                  >
                    {item.common_name}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedLibraryItems((prev) =>
                        prev.filter((i) => i.id !== item.id)
                      )
                    }
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

          {/* Browse library button */}
          <button
            type="button"
            onClick={() => setBrowserOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Browse Plant & Material Library
          </button>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Generate button */}
          <button
            type="submit"
            disabled={generating || credits < 1}
            className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {generating
              ? maskBase64
                ? "Applying edit..."
                : "Generating..."
              : credits < 1
                ? "No credits remaining"
                : maskBase64
                  ? "Apply Edit (1 credit)"
                  : "Generate (1 credit)"}
          </button>

          {credits < 1 && (
            <Link
              href="/pricing"
              className="block text-center text-sm text-primary transition-colors hover:text-primary-light"
            >
              Get more credits
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
