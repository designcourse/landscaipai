"use client";

import { useState } from "react";
import Link from "next/link";
import {
  STYLE_PRESETS,
  TIME_OF_DAY_OPTIONS,
  SEASON_OPTIONS,
  WEATHER_OPTIONS,
} from "@/lib/gemini/prompts";
import type { Image, Generation } from "@/types";

type GenerationWithUrl = Generation & { url: string };

interface GenerationWorkspaceProps {
  image: Image;
  originalImageUrl: string;
  projectId: string;
  projectName: string;
  initialGenerations: GenerationWithUrl[];
  creditsBalance: number;
}

export function GenerationWorkspace({
  image,
  originalImageUrl,
  projectId,
  projectName,
  initialGenerations,
  creditsBalance: initialCredits,
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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;

    if (!style && !customPrompt.trim()) {
      setError("Select a style or enter a custom prompt.");
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: image.id,
          projectId,
          style,
          timeOfDay: timeOfDay || undefined,
          season: season || undefined,
          weather: weather || undefined,
          customPrompt: customPrompt.trim() || undefined,
          parentGenerationId: activeImage.generationId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "NO_CREDITS") {
          setError("You're out of credits. Visit the pricing page to get more.");
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
        style_preset: data.generation.style_preset,
        time_of_day: data.generation.time_of_day,
        season: data.generation.season,
        weather: data.generation.weather,
        is_inpaint: false,
        input_tokens: null,
        output_tokens: null,
        generation_cost_cents: null,
        status: "completed",
        error_message: null,
        created_at: new Date().toISOString(),
        url: data.generation.url,
      };

      setGenerations((prev) => [...prev, newGen]);
      setActiveImage({
        url: newGen.url,
        label: "Generated result",
        generationId: newGen.id,
      });
      setCredits(data.credits_remaining);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/project/${projectId}`}
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
                  Generating your landscape design...
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

          {/* Image label + start over */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{activeImage.label}</p>
            {activeImage.generationId && (
              <button
                onClick={handleStartOver}
                className="text-sm text-primary transition-colors hover:text-primary-light"
              >
                Start over with original
              </button>
            )}
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
                    className={`shrink-0 overflow-hidden rounded-md border-2 ${
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
              Custom Prompt
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add specific requests... e.g., 'Add a stone walkway to the front door with lavender borders'"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Generate button */}
          <button
            type="submit"
            disabled={generating || credits < 1}
            className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {generating
              ? "Generating..."
              : credits < 1
                ? "No credits remaining"
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
