/**
 * Active image-generation model.
 *
 * To swap between providers for A/B comparison in the editor, change this
 * single constant. Both /api/generate and /api/generate/inpaint read from
 * here via getImageModel().
 *
 * Options: "gemini" (Nano Banana 2) | "gemini-pro" (Nano Banana Pro) | "openai" (gpt-image-2)
 */
export const ACTIVE_IMAGE_MODEL: "gemini" | "gemini-pro" | "openai" = "gemini";

/**
 * Number of image variations produced per (non-inpaint) generation request.
 * One credit buys the whole batch; the user picks their favorite. This file is
 * import-safe from client components (pure constants, no server deps).
 */
export const VARIATIONS_PER_GENERATION = 3;

/**
 * Output-resolution cap (longest edge, px) for the multi-variation explore
 * batch. N images per request is N x the API cost, so the explore batch renders
 * small to keep cost + latency bounded; a full-resolution "finalize" of the
 * chosen design is a planned follow-up.
 */
export const VARIATION_MAX_DIMENSION = 1024;

/**
 * When true, fresh (non-iteration) generations run the AI "landscaping planner"
 * — a vision call that analyzes the photo and proposes budget-tiered, tailored
 * design concepts — instead of the generic per-variant directives. Falls back
 * to the template automatically if the planner errors. Flip to false to disable.
 */
export const PLANNER_ENABLED = true;
