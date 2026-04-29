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
