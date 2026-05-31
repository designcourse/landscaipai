export interface StylePresetData {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const STYLE_PRESETS: StylePresetData[] = [
  // Architectural / Contemporary
  {
    id: "modern-minimalist",
    name: "Modern Minimalist",
    category: "Architectural",
    description:
      "Clean lines, geometric planters, ornamental grasses, concrete pavers, restrained palette",
  },
  {
    id: "contemporary-luxe",
    name: "Contemporary Luxe",
    category: "Architectural",
    description:
      "Infinity-edge water features, LED landscape lighting, large-format porcelain tiles, sculptural plants",
  },
  {
    id: "mid-century-modern",
    name: "Mid-Century Modern",
    category: "Architectural",
    description:
      "Desert-adapted plants, exposed aggregate, low-profile ground covers, atomic-age hardscape patterns",
  },
  // Traditional / Classic
  {
    id: "english-cottage",
    name: "English Cottage",
    category: "Traditional",
    description:
      "Overflowing flower beds, climbing roses, stone pathways, white picket borders, wildflower meadow feel",
  },
  {
    id: "french-formal",
    name: "French Formal",
    category: "Traditional",
    description:
      "Symmetrical hedges, boxwood parterres, gravel paths, lavender rows, fountain centerpiece",
  },
  {
    id: "colonial-traditional",
    name: "Colonial Traditional",
    category: "Traditional",
    description:
      "Manicured lawn, foundation shrubs, brick walkway, seasonal flower beds, classic symmetry",
  },
  // Regional / Climate
  {
    id: "desert-xeriscape",
    name: "Desert Xeriscape",
    category: "Regional",
    description:
      "Drought-tolerant plants, succulents, agave, decomposed granite, boulders, no lawn",
  },
  {
    id: "tropical-paradise",
    name: "Tropical Paradise",
    category: "Regional",
    description:
      "Palm trees, bird of paradise, lush ferns, pool integration, tiki/resort feel",
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    category: "Regional",
    description:
      "Olive trees, terracotta pots, stucco walls, lavender, gravel courtyard, warm tones",
  },
  {
    id: "pacific-northwest",
    name: "Pacific Northwest",
    category: "Regional",
    description:
      "Ferns, mosses, native conifers, rain garden, natural stone, green-on-green layering",
  },
  // Lifestyle / Thematic
  {
    id: "japanese-zen",
    name: "Japanese Zen",
    category: "Lifestyle",
    description:
      "Raked gravel, moss, stone lanterns, maple trees, bamboo accents, water basin",
  },
  {
    id: "farmhouse-rustic",
    name: "Farmhouse Rustic",
    category: "Lifestyle",
    description:
      "Raised garden beds, wildflowers, reclaimed wood borders, herb garden, gravel drive",
  },
  {
    id: "entertainers-yard",
    name: "Entertainer's Yard",
    category: "Lifestyle",
    description:
      "Outdoor kitchen, fire pit, string lights, lounge seating, turf lawn, privacy screening",
  },
  {
    id: "kid-friendly",
    name: "Kid-Friendly",
    category: "Lifestyle",
    description:
      "Play areas with soft landscaping, shade trees, wide open lawn, stepping stone paths, no thorny plants",
  },
  // Eco / Low-Maintenance
  {
    id: "native-wildscape",
    name: "Native Wildscape",
    category: "Eco",
    description:
      "All native plants, pollinator garden, no irrigation, meadow aesthetic, natural habitat",
  },
  {
    id: "low-maintenance-evergreen",
    name: "Low-Maintenance Evergreen",
    category: "Eco",
    description:
      "Year-round structure, evergreen shrubs, mulched beds, minimal pruning, automated irrigation",
  },
];

export const TIME_OF_DAY_OPTIONS = [
  "Morning",
  "Afternoon",
  "Golden Hour",
  "Evening",
  "Night",
] as const;

export const SEASON_OPTIONS = [
  "Spring",
  "Summer",
  "Fall",
  "Winter",
] as const;

export const WEATHER_OPTIONS = [
  "Sunny",
  "Partly Cloudy",
  "Overcast",
  "Rainy",
  "Snowy",
  "Foggy",
] as const;

export interface SelectedPlant {
  common_name: string;
  scientific_name: string | null;
  image_path?: string | null;
}

export interface SelectedHardscape {
  common_name: string;
  image_path?: string | null;
}

function formatItemList(
  items: { common_name: string; scientific_name?: string | null; image_path?: string | null }[],
  includeScientific: boolean
): string {
  const hasImages = items.some((i) => i.image_path);
  return items
    .map((item, i) => {
      const name = includeScientific && item.scientific_name
        ? `${item.common_name} (${item.scientific_name})`
        : item.common_name;
      return hasImages && item.image_path ? `${i + 1}. ${name}` : name;
    })
    .join(hasImages ? "\n" : ", ");
}

function hasReferenceImages(items: { image_path?: string | null }[]): boolean {
  return items.some((i) => i.image_path);
}

export interface GenerationParams {
  style: string | null;
  timeOfDay?: string;
  season?: string;
  weather?: string;
  customPrompt?: string;
  selectedPlants?: SelectedPlant[];
  selectedHardscape?: SelectedHardscape[];
  sourceWidth?: number;
  sourceHeight?: number;
  hasReferenceAttachments?: boolean;
  /** Per-variant design nudge (multi-variation batches) — steers composition without overriding the user's prompt. */
  variationDirective?: string;
}

export interface InpaintParams {
  customPrompt: string;
  style?: string | null;
  timeOfDay?: string;
  season?: string;
  weather?: string;
  selectedPlants?: SelectedPlant[];
  selectedHardscape?: SelectedHardscape[];
  hasSceneChange?: boolean;
  hasReferenceAttachments?: boolean;
}

const SYSTEM_CONTEXT =
  "You are a professional landscape designer. Preserve the existing architecture, structures, and non-landscape elements exactly as they appear.";

/**
 * Per-variant "design direction" nudges so one request yields meaningfully
 * different — but on-style — executions. Indexed by variant number. Additive
 * and orthogonal to the user's own prompt: they steer composition (density,
 * structure, focal point), never override an explicit request.
 */
export const VARIATION_DIRECTIVES: string[] = [
  "Design direction for this version: lean into a fuller, more abundant planting layout — denser beds, richer layering, and more greenery — while staying true to the chosen style.",
  "Design direction for this version: lean into a cleaner, more restrained and structured layout — crisp lines, defined bed edges, and open breathing room — while staying true to the chosen style.",
  "Design direction for this version: build the composition around one standout focal point — a specimen tree, water feature, or sculptural planting — appropriate to the chosen style.",
];

export function buildPrompt(params: GenerationParams): string {
  const parts = [SYSTEM_CONTEXT];

  if (params.style) {
    const preset = STYLE_PRESETS.find((p) => p.id === params.style);
    if (preset) {
      parts.push(
        `Apply the "${preset.name}" landscaping style: ${preset.description}.`
      );
    } else {
      parts.push(`Apply the following landscaping style: ${params.style}.`);
    }
  }

  if (params.selectedPlants?.length) {
    const list = formatItemList(params.selectedPlants, true);
    parts.push(
      hasReferenceImages(params.selectedPlants)
        ? `Include the following specific plants in the design. Reference images are provided to show the species — use them to identify the correct plant type, leaf shape, color, and flower style, but each individual plant placed in the scene MUST look naturally unique (vary the size, shape, branching pattern, and maturity). Do NOT duplicate or clone the same plant image multiple times. Place plants in contextually appropriate locations (in garden beds, lawns, borders) with realistic spacing — never overlapping structures or pressed against the house:\n${list}`
        : `Include the following specific plants in the design: ${list}.`
    );
  }

  if (params.selectedHardscape?.length) {
    const list = formatItemList(params.selectedHardscape, false);
    parts.push(
      hasReferenceImages(params.selectedHardscape)
        ? `Include the following hardscape elements. Reference images are provided to show the material and style — use them as a guide for texture, color, and type, but integrate each element naturally into the scene with realistic scale and placement:\n${list}`
        : `Include the following hardscape elements: ${list}.`
    );
  }

  if (params.timeOfDay) parts.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) parts.push(`Season: ${params.season}.`);
  if (params.weather) parts.push(`Weather conditions: ${params.weather}.`);
  if (params.hasReferenceAttachments) {
    parts.push(
      "Additional reference images have been attached by the user. Use them as visual context — they may show specific features, materials, styles, or elements the user wants incorporated or matched in the design. Follow the user's custom instructions regarding how to use these references."
    );
  }

  if (params.variationDirective) parts.push(params.variationDirective);

  if (params.customPrompt) parts.push(params.customPrompt);

  if (params.sourceWidth && params.sourceHeight) {
    parts.push(
      `CRITICAL: The output image MUST have exactly the same aspect ratio as the input image (${params.sourceWidth}×${params.sourceHeight}). Do not crop, stretch, widen, or change the framing in any way. The camera angle, field of view, and composition must remain identical.`
    );
  }

  parts.push(
    "Keep the house structure, driveway, and all non-landscape elements completely intact. Make it look photorealistic and professional."
  );

  return parts.join(" ");
}

/**
 * Aspect-ratio + preservation guardrails (identical wording to buildPrompt),
 * exported so AI-planner-generated prompts get the same constraints appended
 * before they go to the image model.
 */
export function buildAspectGuardrails(sourceWidth: number, sourceHeight: number): string {
  return (
    `CRITICAL: The output image MUST have exactly the same aspect ratio as the input image (${sourceWidth}×${sourceHeight}). Do not crop, stretch, widen, or change the framing in any way. The camera angle, field of view, and composition must remain identical. ` +
    "Keep the house structure, driveway, and all non-landscape elements completely intact. Make it look photorealistic and professional."
  );
}

/**
 * The plant / hardscape / time / season / weather / reference-attachment lines
 * (same wording buildPrompt uses), as one string — appended to AI-planner
 * prompts so the planner path honors the same settings + library selections as
 * the template path.
 */
export function buildDetailLines(params: {
  timeOfDay?: string;
  season?: string;
  weather?: string;
  selectedPlants?: SelectedPlant[];
  selectedHardscape?: SelectedHardscape[];
  hasReferenceAttachments?: boolean;
}): string {
  const lines: string[] = [];

  if (params.selectedPlants?.length) {
    const list = formatItemList(params.selectedPlants, true);
    lines.push(
      hasReferenceImages(params.selectedPlants)
        ? `Include the following specific plants in the design. Reference images are provided to show the species — use them to identify the correct plant type, leaf shape, color, and flower style, but each individual plant placed in the scene MUST look naturally unique (vary the size, shape, branching pattern, and maturity). Do NOT duplicate or clone the same plant image multiple times. Place plants in contextually appropriate locations (in garden beds, lawns, borders) with realistic spacing — never overlapping structures or pressed against the house:\n${list}`
        : `Include the following specific plants in the design: ${list}.`
    );
  }

  if (params.selectedHardscape?.length) {
    const list = formatItemList(params.selectedHardscape, false);
    lines.push(
      hasReferenceImages(params.selectedHardscape)
        ? `Include the following hardscape elements. Reference images are provided to show the material and style — use them as a guide for texture, color, and type, but integrate each element naturally into the scene with realistic scale and placement:\n${list}`
        : `Include the following hardscape elements: ${list}.`
    );
  }

  if (params.timeOfDay) lines.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) lines.push(`Season: ${params.season}.`);
  if (params.weather) lines.push(`Weather conditions: ${params.weather}.`);
  if (params.hasReferenceAttachments) {
    lines.push(
      "Additional reference images have been attached by the user. Use them as visual context — they may show specific features, materials, styles, or elements the user wants incorporated or matched in the design. Follow the user's custom instructions regarding how to use these references."
    );
  }

  return lines.join(" ");
}

export function buildInpaintPrompt(params: InpaintParams): string {
  const sceneWide = params.hasSceneChange && (params.timeOfDay || params.season || params.weather);

  const parts = [
    "Generate an image: Edit this photo. The green highlighted area marks the region to change.",
    `Inside the green area: ${params.customPrompt}`,
  ];

  if (sceneWide) {
    // Scene-wide settings changed — tell Gemini to apply them to the ENTIRE image
    parts.push(
      "Objects in the green area must be correctly scaled relative to structures in the scene — respect the depth and distance in the image.",
      "Outside the green area: keep the same plants, structures, composition, and camera angle, but apply the scene-wide lighting/atmosphere changes (time of day, season, weather listed below) to the ENTIRE image — not just the masked area. The whole scene must look consistent."
    );
  } else {
    parts.push(
      "The new content MUST match the existing photo's lighting, color temperature, brightness, contrast, shadows, and perspective. Objects must be correctly scaled relative to structures in the scene — respect the depth and distance in the image.",
      "Outside the green area: keep everything exactly as-is — same plants, same structures, same lighting, same perspective, same camera angle."
    );
  }

  if (params.style) {
    const preset = STYLE_PRESETS.find((p) => p.id === params.style);
    if (preset) {
      parts.push(
        `Style for the edited area: "${preset.name}" — ${preset.description}.`
      );
    }
  }

  if (params.selectedPlants?.length) {
    const list = formatItemList(params.selectedPlants, true);
    parts.push(
      hasReferenceImages(params.selectedPlants)
        ? `Use these specific plants in the edited area. Reference images show the species — match the plant type, leaf shape, color, and flower style, but each individual plant MUST look naturally unique (vary size, shape, branching, maturity). Do NOT clone the reference image:\n${list}`
        : `Use these specific plants in the edited area: ${list}.`
    );
  }

  if (params.selectedHardscape?.length) {
    const list = formatItemList(params.selectedHardscape, false);
    parts.push(
      hasReferenceImages(params.selectedHardscape)
        ? `Use these hardscape elements in the edited area. Reference images show the material and style — match the texture and type, but integrate naturally into the scene:\n${list}`
        : `Use these hardscape elements in the edited area: ${list}.`
    );
  }

  if (params.hasReferenceAttachments) {
    parts.push(
      "Additional reference images have been attached by the user. Use them as visual context for the edit — they may show specific features, materials, styles, or elements to incorporate into the masked area. Follow the user's prompt regarding how to use these references."
    );
  }

  if (params.timeOfDay) parts.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) parts.push(`Season: ${params.season}.`);
  if (params.weather) parts.push(`Weather conditions: ${params.weather}.`);

  if (sceneWide) {
    parts.push(
      "Maintain the exact same camera angle, lens perspective, and depth of field as the original photo. Apply the time/season/weather changes uniformly across the entire scene."
    );
  } else {
    parts.push(
      "Maintain the exact same camera angle, lens perspective, and depth of field as the original photo. Only modify what is inside the green highlighted region."
    );
  }

  return parts.join(" ");
}

/**
 * Prompt for OpenAI gpt-image-2 `images.edit`.
 *
 * Unlike Gemini (which receives a JPEG with a red/green overlay baked into
 * the image), OpenAI receives a CLEAN source + a separate alpha-channel mask.
 * The model already knows the edit region from the mask — we must NOT reference
 * any visual overlay ("green area", "red overlay"), or it will hallucinate.
 */
export function buildInpaintPromptForOpenAI(params: InpaintParams): string {
  const sceneWide = params.hasSceneChange && (params.timeOfDay || params.season || params.weather);

  const parts = [
    `Edit only the masked (transparent) region of this photo: ${params.customPrompt}.`,
  ];

  if (sceneWide) {
    parts.push(
      "New content must be correctly scaled relative to structures in the scene — respect depth and perspective.",
      "For areas outside the mask, keep the same plants, structures, composition, and camera angle, but apply the scene-wide lighting/atmosphere changes (time of day, season, weather listed below) uniformly to the ENTIRE image so the whole scene is visually consistent."
    );
  } else {
    parts.push(
      "Match the existing photo's lighting, color temperature, brightness, contrast, shadows, and perspective exactly. New content must be scaled correctly relative to surrounding structures.",
      "Keep everything outside the masked region exactly as it appears in the source photo — do not modify any other part of the image."
    );
  }

  if (params.style) {
    const preset = STYLE_PRESETS.find((p) => p.id === params.style);
    if (preset) {
      parts.push(`Style for the edited area: "${preset.name}" — ${preset.description}.`);
    }
  }

  if (params.selectedPlants?.length) {
    const list = formatItemList(params.selectedPlants, true);
    parts.push(
      hasReferenceImages(params.selectedPlants)
        ? `Use these specific plants in the edited area (reference images show species — match leaf shape, color, and flower style, but vary size/shape/maturity so each plant looks unique):\n${list}`
        : `Use these specific plants in the edited area: ${list}.`
    );
  }

  if (params.selectedHardscape?.length) {
    const list = formatItemList(params.selectedHardscape, false);
    parts.push(
      hasReferenceImages(params.selectedHardscape)
        ? `Use these hardscape elements in the edited area (reference images show texture/material — integrate naturally):\n${list}`
        : `Use these hardscape elements in the edited area: ${list}.`
    );
  }

  if (params.hasReferenceAttachments) {
    parts.push(
      "Additional reference images have been attached by the user. Use them as visual context for the edit area only."
    );
  }

  if (params.timeOfDay) parts.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) parts.push(`Season: ${params.season}.`);
  if (params.weather) parts.push(`Weather conditions: ${params.weather}.`);

  if (sceneWide) {
    parts.push(
      "Maintain the exact same camera angle, lens perspective, and depth of field as the original photo. Apply time/season/weather changes uniformly across the entire scene."
    );
  } else {
    parts.push(
      "Maintain the exact same camera angle, lens perspective, and depth of field as the original photo."
    );
  }

  return parts.join(" ");
}
