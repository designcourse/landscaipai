/**
 * Composition timing constants for the Finalize Video composition.
 *
 * The veo source plays at its native fps via <OffthreadVideo>; Remotion
 * handles the resampling so we can pin the composition fps independently
 * of the source. We use 30 fps for the composition because it gives smoother
 * card animations than the 24 fps Veo native rate.
 */

export const COMPOSITION_FPS = 30;

// How long the asset cards animate in over (per-card duration).
export const ASSET_CARD_ENTRY_FRAMES = 18; // 0.6s @ 30fps

// Stagger between successive asset card entries.
export const ASSET_CARD_STAGGER_FRAMES = 6; // 0.2s @ 30fps

// How long before the end of the veo phase to start the asset cards entering.
export const ASSET_CARDS_LEAD_IN_SECONDS = 2;

// How long the freeze frame holds at the end of the video, with asset cards
// + branding card visible. Replaces the previous separate "asset hold" and
// "branding hold" phases.
export const FREEZE_HOLD_SECONDS = 7;

// Address card fade in/out durations.
export const ADDRESS_CARD_FADE_FRAMES = 14; // ~0.45s @ 30fps

// Branding card per-element entry stagger (logo → name → phone → note).
export const BRANDING_ELEMENT_ENTRY_FRAMES = 16; // ~0.53s @ 30fps
export const BRANDING_ELEMENT_STAGGER_FRAMES = 6; // 0.2s @ 30fps

// Plant info card sequence (shown after branding card, one per asset).
export const PLANT_INFO_SECONDS_PER_ASSET = 5;
export const PLANT_INFO_ENTER_FRAMES = 30; // 1s @ 30fps
export const PLANT_INFO_EXIT_FRAMES = 18; // 0.6s @ 30fps
export const PLANT_INFO_PILL_STAGGER_FRAMES = 3; // 0.1s between pills
export const PLANT_INFO_TEXT_STAGGER_FRAMES = 4; // stagger between title → desc → pills

export const seconds = (n: number, fps: number = COMPOSITION_FPS) =>
  Math.round(n * fps);
