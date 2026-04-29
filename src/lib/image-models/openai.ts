import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { withGeminiRetry } from "@/lib/gemini/with-retry";
import type {
  GenerateInput,
  ImageModelProvider,
  ImageModelResult,
  InlineImage,
  InpaintInput,
  InpaintResult,
} from "./types";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _client;
}

type OpenAISize = "1024x1024" | "1536x1024" | "1024x1536";

function pickSize(width: number, height: number): OpenAISize {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.83) return "1024x1536";
  return "1024x1024";
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function inlineToFile(img: InlineImage, baseName: string) {
  const buf = Buffer.from(img.base64, "base64");
  return toFile(buf, `${baseName}.${extFromMime(img.mimeType)}`, { type: img.mimeType });
}

async function bufferToFile(buf: Buffer, mime: string, baseName: string) {
  return toFile(buf, `${baseName}.${extFromMime(mime)}`, { type: mime });
}

/**
 * Convert the client's grayscale raw mask (white = edit area) into the
 * alpha-channel PNG that OpenAI's images.edit expects (alpha=0 = edit area).
 *
 * Defensive: explicitly flattens the mask over black in case the client
 * drew on a transparent background, and asserts single-channel after
 * grayscale so we can't silently misalign bytes.
 */
async function rawMaskToOpenAIMask(
  rawMaskBase64: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const maskBuffer = Buffer.from(rawMaskBase64, "base64");

  const { data: gray, info } = await sharp(maskBuffer)
    .resize(width, height, { fit: "fill" })
    .flatten({ background: "#000000" }) // drop transparency → black bg
    .grayscale()
    .toColorspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1 || gray.length !== width * height) {
    throw new Error(
      `mask conversion: expected ${width * height} bytes single-channel, got ${gray.length} bytes with ${info.channels} channels`,
    );
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 0;
    rgba[i * 4 + 1] = 0;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = 255 - gray[i];
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function friendlyOpenAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  if (status === 429 || /rate_limit|quota/i.test(raw)) {
    return "AI service is busy right now — please try again in a moment.";
  }
  if (status === 400 && /safety|content_policy|moderation/i.test(raw)) {
    return "Your request was blocked by the AI's safety filters. Try rephrasing or selecting a different style.";
  }
  if (status === 400) {
    return "The AI couldn't understand the request. Try a different prompt.";
  }
  if (status === 401 || status === 403) {
    return "AI service is not available (auth error).";
  }
  return raw.replace(/^OpenAI\s*Error:\s*/i, "");
}

export const openaiProvider: ImageModelProvider = {
  name: "openai",

  async generate(input: GenerateInput): Promise<ImageModelResult> {
    const images = await Promise.all([
      inlineToFile(input.sourceImage, "source"),
      ...input.referenceImages.map((ref, i) => inlineToFile(ref, `ref-${i}`)),
    ]);

    const response = await withGeminiRetry(
      () =>
        client().images.edit({
          model: "gpt-image-2",
          image: images,
          prompt: input.prompt,
          size: pickSize(input.width, input.height),
          quality: "high",
        }),
      { onRetry: input.onRetry },
    );

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from OpenAI");
    return { base64: b64 };
  },

  /**
   * OpenAI inpaint — fully self-contained pipeline, intentionally separate
   * from Gemini's path:
   *   1. Build an RGBA mask (transparent = edit area) from rawMaskBase64.
   *   2. Send the CLEAN source + mask + prompt to images.edit.
   *   3. Resize the output to source dimensions.
   *   4. Encode as WebP and return.
   *
   * NO compositing, NO feathering, NO red-overlay image — OpenAI already
   * edits only inside the mask and returns a full-frame image with the rest
   * preserved.
   */
  async inpaint(input: InpaintInput): Promise<InpaintResult> {
    if (!input.rawMaskBase64) {
      throw new Error("OpenAI inpaint requires a raw mask");
    }

    const maskPng = await rawMaskToOpenAIMask(
      input.rawMaskBase64,
      input.width,
      input.height,
    );

    const [sourceFile, maskFile, ...refFiles] = await Promise.all([
      bufferToFile(input.sourceBuffer, input.sourceMimeType, "source"),
      toFile(maskPng, "mask.png", { type: "image/png" }),
      ...input.referenceImages.map((ref, i) => inlineToFile(ref, `ref-${i}`)),
    ]);

    const response = await withGeminiRetry(
      () =>
        client().images.edit({
          model: "gpt-image-2",
          image: refFiles.length > 0 ? [sourceFile, ...refFiles] : sourceFile,
          mask: maskFile,
          prompt: input.prompt,
          size: pickSize(input.width, input.height),
          quality: "high",
        }),
      { onRetry: input.onRetry },
    );

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from OpenAI");

    const buffer = await sharp(Buffer.from(b64, "base64"))
      .resize(input.width, input.height, { fit: "fill" })
      .webp({ quality: 90 })
      .toBuffer();

    return { buffer, mimeType: "image/webp" };
  },

  friendlyError(err: unknown): string {
    return friendlyOpenAIError(err);
  },
};
