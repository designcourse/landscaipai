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
}

export interface InpaintParams {
  customPrompt: string;
  style?: string | null;
  timeOfDay?: string;
  season?: string;
  weather?: string;
  selectedPlants?: SelectedPlant[];
  selectedHardscape?: SelectedHardscape[];
}

const SYSTEM_CONTEXT =
  "You are a professional landscape designer. Preserve the existing architecture, structures, and non-landscape elements exactly as they appear.";

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
        ? `Include the following specific plants in the design. Reference images are provided in order — match their appearance closely:\n${list}`
        : `Include the following specific plants in the design: ${list}.`
    );
  }

  if (params.selectedHardscape?.length) {
    const list = formatItemList(params.selectedHardscape, false);
    parts.push(
      hasReferenceImages(params.selectedHardscape)
        ? `Include the following hardscape elements. Reference images are provided in order — match their appearance closely:\n${list}`
        : `Include the following hardscape elements: ${list}.`
    );
  }

  if (params.timeOfDay) parts.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) parts.push(`Season: ${params.season}.`);
  if (params.weather) parts.push(`Weather conditions: ${params.weather}.`);
  if (params.customPrompt) parts.push(params.customPrompt);

  parts.push(
    "Keep the house structure, driveway, and all non-landscape elements completely intact. Make it look photorealistic and professional."
  );

  return parts.join(" ");
}

export function buildInpaintPrompt(params: InpaintParams): string {
  const parts = [
    "Generate an image: Edit this photo. The green highlighted area marks the region to change.",
    `Inside the green area: ${params.customPrompt}`,
    "The new content MUST match the existing photo's lighting, color temperature, brightness, contrast, shadows, and perspective. Objects must be correctly scaled relative to structures in the scene — respect the depth and distance in the image.",
    "Outside the green area: keep everything exactly as-is — same plants, same structures, same lighting, same perspective, same camera angle.",
  ];

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
        ? `Use these specific plants in the edited area. Reference images are provided in order — match their appearance closely:\n${list}`
        : `Use these specific plants in the edited area: ${list}.`
    );
  }

  if (params.selectedHardscape?.length) {
    const list = formatItemList(params.selectedHardscape, false);
    parts.push(
      hasReferenceImages(params.selectedHardscape)
        ? `Use these hardscape elements in the edited area. Reference images are provided in order — match their appearance closely:\n${list}`
        : `Use these hardscape elements in the edited area: ${list}.`
    );
  }

  if (params.timeOfDay) parts.push(`Time of day: ${params.timeOfDay}.`);
  if (params.season) parts.push(`Season: ${params.season}.`);
  if (params.weather) parts.push(`Weather conditions: ${params.weather}.`);

  parts.push(
    "Maintain the exact same camera angle, lens perspective, and depth of field as the original photo. Only modify what is inside the green highlighted region."
  );

  return parts.join(" ");
}
