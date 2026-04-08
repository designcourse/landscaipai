/**
 * Video generation presets and prompt builder for Veo 3.1.
 * These presets translate UI choices into a single motion prompt that guides
 * the transition between a user-selected start frame and end frame.
 */

// ============================================================
// Models
// ============================================================
export interface VideoModelOption {
  id: string;
  name: string;
  description: string;
  // Multiplier applied to the base credit cost (see computeCreditCost below)
  costMultiplier: number;
  // Underlying Gemini API model identifier
  apiModel: string;
}

export const VIDEO_MODELS: readonly VideoModelOption[] = [
  {
    id: "veo-3.1-fast",
    name: "Veo 3.1 Fast",
    description: "Google's fastest first/last frame model. Best default.",
    costMultiplier: 1,
    apiModel: "veo-3.1-fast-generate-preview",
  },
  {
    id: "veo-3.1",
    name: "Veo 3.1",
    description: "Highest fidelity. Slower but more detailed motion.",
    costMultiplier: 1.5,
    apiModel: "veo-3.1-generate-preview",
  },
] as const;

export const DEFAULT_VIDEO_MODEL_ID = "veo-3.1-fast";

// ============================================================
// Duration + resolution
// ============================================================
// Per Veo 3.1 docs, first+last frame interpolation requires 8s.
// We still allow shorter durations in the UI for text-only future use,
// but the video route always forces 8s when both frames are provided.
export const DURATION_OPTIONS = [8] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

// Per product decision: no 4K export. Only 720p and 1080p.
// Note: Veo 3.1 via the Gemini Developer API only accepts "720p" or "1080p"
// for the `resolution` config field — it rejects "2k" with INVALID_ARGUMENT.
export const RESOLUTION_OPTIONS = [
  { id: "720p", label: "720p", description: "Fast, economical" },
  { id: "1080p", label: "1080p", description: "Sharp, higher cost" },
] as const;
export type ResolutionOption = (typeof RESOLUTION_OPTIONS)[number]["id"];

export const DEFAULT_RESOLUTION: ResolutionOption = "720p";

// ============================================================
// Camera movement presets
// ============================================================
export interface CameraPreset {
  id: string;
  name: string;
  description: string;
  // Fragment injected into the final prompt
  motionFragment: string;
}

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  {
    id: "stationary",
    name: "Stationary",
    description: "Locked-off camera. No movement.",
    motionFragment:
      "Camera technique: locked-off static shot, fixed tripod. The camera does NOT move at all throughout the entire video — no pan, no tilt, no dolly, no zoom, no rotation. The framing remains identical from the first frame to the last frame.",
  },
  {
    id: "slow_push_in",
    name: "Slow Push-In",
    description: "Gentle forward dolly toward the scene.",
    motionFragment:
      "Camera technique: a slow dolly-in shot. The camera physically translates forward toward the scene at a steady, gentle pace over the full duration of the shot, gradually decreasing the distance between the lens and the main subject. Begins wider, ends slightly closer. This is a classic forward dolly cinematography movement — NOT a digital zoom.",
  },
  {
    id: "slow_pull_out",
    name: "Slow Pull-Out",
    description: "Gentle backward dolly revealing more of the scene.",
    motionFragment:
      "Camera technique: a slow dolly-out shot. The camera physically translates backward away from the scene at a steady, gentle pace over the full duration, gradually revealing more of the surroundings. Begins tighter, ends slightly wider. This is a classic dolly-out / pull-back cinematography movement — NOT a digital zoom.",
  },
  {
    id: "orbit_left",
    name: "Orbit Left",
    description: "Arc camera left around the subject.",
    motionFragment:
      "Camera technique: an arc shot orbiting counter-clockwise (to the left) around the main subject. The camera moves laterally along a smooth circular path while continuously framing the subject in the center. Begins on the right side, ends on the left side. This is a cinematic orbit / arc shot movement.",
  },
  {
    id: "orbit_right",
    name: "Orbit Right",
    description: "Arc camera right around the subject.",
    motionFragment:
      "Camera technique: an arc shot orbiting clockwise (to the right) around the main subject. The camera moves laterally along a smooth circular path while continuously framing the subject in the center. Begins on the left side, ends on the right side. This is a cinematic orbit / arc shot movement.",
  },
  {
    id: "crane_up",
    name: "Rising Shot",
    description: "Camera lifts from low to high angle.",
    motionFragment:
      "Camera technique: a rising pedestal shot. The camera physically rises smoothly upward from a lower vantage point to a higher vantage point over the full duration. The viewing angle gradually elevates, looking down from a slightly higher position by the end. This is a cinematography pedestal-up / boom-up shot — purely a camera movement, not an object in the scene.",
  },
  {
    id: "aerial_reveal",
    name: "Aerial Reveal",
    description: "Drone-like pull back and up.",
    motionFragment:
      "Camera technique: a cinematic drone-style reveal. The camera physically translates backward and rises upward simultaneously over the full duration, gradually revealing the wider landscape context. Begins lower and closer, ends higher and farther. This is a smooth aerial pull-back cinematography movement — not an object in the scene.",
  },
] as const;

export const DEFAULT_CAMERA_PRESET_ID = "slow_push_in";

// ============================================================
// Transition presets (how the first frame morphs into the last)
// ============================================================
export interface TransitionPreset {
  id: string;
  name: string;
  description: string;
  promptFragment: string;
  // Mark experimental transitions so the UI can label them
  experimental?: boolean;
}

export const TRANSITION_PRESETS: readonly TransitionPreset[] = [
  {
    id: "natural_morph",
    name: "Natural Morph",
    description: "Smooth, physically plausible transition between the two states.",
    promptFragment:
      "Strict interpolation between the two reference frames only. Smoothly and naturally morph the " +
      "first frame into the last frame over the full duration. " +
      "ABSOLUTELY CRITICAL constraint: every visible element at every moment in the video must be " +
      "directly attributable to either the first reference frame or the last reference frame. " +
      "Do NOT introduce any new objects, plants, trees, shrubs, flowers, hardscape, structures, " +
      "buildings, vehicles, animals, people, weather effects, or any other content that is not " +
      "present in one of the two given frames. If a plant exists only in the last frame, it should " +
      "fade in or grow in over time from where it ends up. If an object exists only in the first " +
      "frame, it should fade out or transform smoothly. Treat the video strictly as a temporal " +
      "interpolation problem — NOT a creative generation. Match lighting, perspective, and camera " +
      "framing exactly between the two frames. No hard cuts, no dissolves to unrelated content, " +
      "no interstitial scenes, no transitional imagery — a continuous, physically plausible " +
      "transformation of ONLY the landscaping elements that appear in the two frames.",
  },
  {
    id: "timelapse_growth",
    name: "Time-Lapse Growth",
    description: "Fast-forward seasonal/plant growth from first to second scene.",
    promptFragment:
      "Depict the transition as an accelerated time-lapse: vegetation grows, fills in, and matures from the " +
      "first scene's state into the second scene's state. Plants visibly sprout, leaves unfurl, flowers bloom " +
      "as time accelerates. Shadows shift subtly to suggest the passage of hours. End precisely on the framing " +
      "and content of the final frame.",
  },
  {
    id: "season_shift",
    name: "Seasonal Shift",
    description: "Transition through a changing season.",
    promptFragment:
      "Transition through a changing season between the two frames. Light, foliage color, and atmospheric " +
      "conditions gradually shift from the first scene's season into the second scene's season, landing " +
      "precisely on the final frame's appearance.",
  },
  {
    id: "day_to_night",
    name: "Day → Evening",
    description: "Time-of-day transition with warming light.",
    promptFragment:
      "Transition the time of day from the first frame to the second frame. The sun moves, shadows lengthen, " +
      "light color temperature shifts warmer, and the overall atmosphere changes, ending exactly on the " +
      "final frame's lighting conditions.",
  },
  {
    id: "degrowth_regrowth",
    name: "Degrowth → Regrowth",
    description:
      "Experimental: existing plants wither and die back, then new landscaping grows in place.",
    experimental: true,
    promptFragment:
      "Cinematic two-stage transformation. In the first half (roughly 0-3 seconds), any existing vegetation " +
      "and plantings in the scene wilt, brown, and die back to bare earth — an accelerated decay time-lapse. " +
      "In the second half (roughly 3-8 seconds), new vegetation and landscaping elements sprout from the " +
      "bare earth, grow upward, leaves unfurl, and mature into the exact configuration shown in the final " +
      "frame. The transformation must land precisely on the final frame's composition, framing, and content. " +
      "Maintain consistent lighting and camera framing throughout.",
  },
  {
    id: "construction",
    name: "Build Time-Lapse",
    description: "Hardscape elements fade into place over time.",
    promptFragment:
      "Accelerated landscape time-lapse showing the finished design assembling itself by magic. " +
      "Hardscape elements such as pavers, retaining walls, planters, and garden features fade into existence " +
      "with smooth dissolve animations and settle into their final positions. Simultaneously, plants and " +
      "vegetation grow upward and fill in around them in a natural growth time-lapse. The transformation " +
      "must be entirely visual — magical materialization and growth only, with NO machinery, NO heavy " +
      "equipment, NO cranes, NO trucks, NO workers, NO tools, NO scaffolding, NO ladders ever appearing " +
      "in the scene. End precisely on the final frame's exact composition.",
  },
] as const;

export const DEFAULT_TRANSITION_PRESET_ID = "natural_morph";

// ============================================================
// Credit cost
// ============================================================
// Base cost per second for a 720p video. 1080p costs 2x per second.
// Model multiplier stacks on top.
const BASE_COST_PER_SECOND = 1.5;

export function computeCreditCost(opts: {
  modelId: string;
  durationSeconds: number;
  resolution: ResolutionOption;
}): number {
  const model = VIDEO_MODELS.find((m) => m.id === opts.modelId);
  const modelMult = model?.costMultiplier ?? 1;
  const resMult = opts.resolution === "1080p" ? 2 : 1;
  const raw = BASE_COST_PER_SECOND * opts.durationSeconds * resMult * modelMult;
  return Math.max(1, Math.ceil(raw));
}

// ============================================================
// Prompt builder
// ============================================================
export function buildVideoPrompt(opts: {
  cameraPresetId: string;
  transitionPresetId: string;
  customPrompt?: string;
}): string {
  const camera = CAMERA_PRESETS.find((c) => c.id === opts.cameraPresetId);
  const transition = TRANSITION_PRESETS.find((t) => t.id === opts.transitionPresetId);

  // Veo 3.1 prompting guideline: lead with cinematography, then subject, then
  // action, then context. We treat the two reference frames as the visual
  // context bookends, and use the prompt to dictate camera technique +
  // transformation in between.
  const parts: string[] = [
    "Cinematic landscape architecture video using first-frame-to-last-frame interpolation. " +
      "The video MUST begin exactly on the first reference frame and end exactly on the last reference frame. " +
      "The intermediate frames must be a smooth interpolation between ONLY the visual content present " +
      "in the two given reference frames — do NOT hallucinate or invent any objects, plants, structures, " +
      "people, vehicles, or other elements that are not present in either the first frame or the last frame. " +
      "Treat this as a strict visual interpolation task, not creative generation. " +
      "Photorealistic, professional cinematography quality.",
  ];

  if (camera) parts.push(camera.motionFragment);
  if (transition) parts.push(transition.promptFragment);

  if (opts.customPrompt?.trim()) {
    parts.push(`Additional direction: ${opts.customPrompt.trim()}`);
  }

  return parts.join(" ");
}

/**
 * Negative prompt — items Veo should NEVER add to the scene. This is the
 * proper place for exclusions because Veo's `negativePrompt` config field
 * is a dedicated channel for "don't render this", and it's far more reliable
 * than trying to write "do not include X" inside the main prompt.
 *
 * The construction-crane case is the canonical example: when the prompt
 * contains the word "crane" (even as a verb in "crane shot"), the model can
 * latch onto the literal object meaning and place a construction crane in
 * the scene. Listing it here suppresses that.
 */
export function buildVideoNegativePrompt(): string {
  return [
    // Literal misinterpretations of cinematography terms
    "crane",
    "construction crane",
    "mechanical crane",
    "tower crane",
    "mobile crane",
    "boom lift",
    "cherry picker",
    // Equipment / machinery
    "construction equipment",
    "heavy equipment",
    "machinery",
    "tools",
    "lifts",
    "scaffolding",
    "ladders",
    "wheelbarrows",
    "shovels",
    "rakes",
    "hoses",
    "buckets",
    // Vehicles
    "vehicles",
    "trucks",
    "trailers",
    "tractors",
    "bulldozers",
    "excavators",
    "diggers",
    "skid steers",
    "drones in frame",
    "helicopters",
    // People
    "people",
    "humans",
    "person",
    "workers",
    "construction workers",
    "landscapers",
    // Text + branding
    "text overlays",
    "watermarks",
    "logos",
    "captions",
    "subtitles",
    "signs",
  ].join(", ");
}
