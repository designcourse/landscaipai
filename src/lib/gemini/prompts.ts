export const STYLE_PRESETS = [
  "modern-minimalist",
  "tropical-paradise",
  "english-cottage",
  "japanese-zen",
  "mediterranean",
  "desert-xeriscape",
  "formal-french",
  "rustic-farmhouse",
  "coastal-beach",
  "woodland-natural",
  "contemporary-urban",
  "prairie-native",
  "tuscan-villa",
  "mountain-lodge",
  "colonial-classic",
  "southwest-adobe",
] as const;

export type StylePreset = (typeof STYLE_PRESETS)[number];

export interface GenerationParams {
  style: StylePreset | string;
  timeOfDay?: string;
  season?: string;
  weather?: string;
  customPrompt?: string;
}

export function buildPrompt(params: GenerationParams): string {
  const parts = [
    `Transform this house photo into a professional landscaping design in the "${params.style}" style.`,
  ];

  if (params.timeOfDay) parts.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) parts.push(`Season: ${params.season}.`);
  if (params.weather) parts.push(`Weather: ${params.weather}.`);
  if (params.customPrompt) parts.push(params.customPrompt);

  parts.push(
    "Keep the house structure intact. Only modify the landscaping, yard, and outdoor elements. Make it look photorealistic."
  );

  return parts.join(" ");
}
