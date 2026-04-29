export interface InlineImage {
  base64: string;
  mimeType: string;
}

export interface GenerateInput {
  sourceImage: InlineImage;
  referenceImages: InlineImage[];
  prompt: string;
  width: number;
  height: number;
  onRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
}

/**
 * Full inpaint input. Each provider owns its own post-processing pipeline
 * (compositing, resizing, etc.) and returns a final ready-to-upload image.
 */
export interface InpaintInput {
  /** Clean source image bytes. Providers may use for compositing and resize targets. */
  sourceBuffer: Buffer;
  sourceMimeType: string;
  /** Source image with the red overlay mask baked in — consumed by Gemini. */
  maskOverlayImage: InlineImage;
  /** Grayscale PNG where white = edit area — consumed by OpenAI, and by Gemini for compositing. */
  rawMaskBase64?: string;
  referenceImages: InlineImage[];
  prompt: string;
  width: number;
  height: number;
  /** True when time/season/weather changed from parent — Gemini skips the composite step in that case. */
  hasSceneChange: boolean;
  onRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
}

export interface ImageModelResult {
  /** Raw generated image bytes, base64 encoded. Used by generate. */
  base64: string;
}

/**
 * Final inpaint result — a ready-to-upload image buffer. Provider owns all
 * post-processing, so the route does not need provider-specific logic.
 */
export interface InpaintResult {
  buffer: Buffer;
  mimeType: string;
}

export interface ImageModelProvider {
  name: string;
  generate(input: GenerateInput): Promise<ImageModelResult>;
  inpaint(input: InpaintInput): Promise<InpaintResult>;
  friendlyError(err: unknown): string;
}
