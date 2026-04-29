import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { withGeminiRetry, friendlyGeminiError } from "@/lib/gemini/with-retry";
import type {
  GenerateInput,
  ImageModelProvider,
  ImageModelResult,
  InpaintInput,
  InpaintResult,
} from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function getImageSize(width: number, height: number): string {
  const longest = Math.max(width, height);
  if (longest <= 512) return "512px";
  if (longest <= 1024) return "1K";
  if (longest <= 2048) return "2K";
  return "4K";
}

/**
 * Gemini regenerates the WHOLE image, so we composite it with the source using
 * the raw mask to preserve pixel-perfect fidelity outside the edit area and
 * feather the boundary. Gemini-specific — does NOT run for OpenAI.
 */
async function compositeWithMask(
  originalBuffer: Buffer,
  generatedBuffer: Buffer,
  maskBuffer: Buffer,
): Promise<Buffer> {
  const { width: w, height: h } = await sharp(originalBuffer).metadata();
  const width = w!;
  const height = h!;

  const featherRadius = Math.max(7, Math.round(Math.min(width, height) * 0.01));
  const sigma = featherRadius % 2 === 0 ? featherRadius + 1 : featherRadius;

  const [resizedGenerated, processedMask, originalRaw] = await Promise.all([
    sharp(generatedBuffer).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(maskBuffer).resize(width, height, { fit: "fill" }).grayscale().blur(sigma).raw().toBuffer(),
    sharp(originalBuffer).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer(),
  ]);

  const outputPixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const maskVal = processedMask[i] / 255;
    const ri = i * 3;
    outputPixels[ri] = Math.round(originalRaw[ri] * (1 - maskVal) + resizedGenerated[ri] * maskVal);
    outputPixels[ri + 1] = Math.round(originalRaw[ri + 1] * (1 - maskVal) + resizedGenerated[ri + 1] * maskVal);
    outputPixels[ri + 2] = Math.round(originalRaw[ri + 2] * (1 - maskVal) + resizedGenerated[ri + 2] * maskVal);
  }

  return sharp(outputPixels, { raw: { width, height, channels: 3 } })
    .webp({ quality: 90 })
    .toBuffer();
}

function createGeminiProvider(options: {
  name: string;
  modelId: string;
}): ImageModelProvider {
  async function callGemini(
    parts: { inlineData?: { mimeType: string; data: string }; text?: string }[],
    width: number,
    height: number,
    onRetry?: GenerateInput["onRetry"],
  ): Promise<string> {
    const response = await withGeminiRetry(
      () =>
        ai.models.generateContent({
          model: options.modelId,
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { imageSize: getImageSize(width, height) },
          },
        }),
      { onRetry },
    );

    let textResponse = "";
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) return part.inlineData.data;
      if (part.text) textResponse += part.text;
    }

    const detail = textResponse
      ? `Gemini responded with text instead of an image: "${textResponse.slice(0, 200)}"`
      : "No image returned from Gemini";
    throw new Error(detail);
  }

  return {
    name: options.name,

    async generate(input: GenerateInput): Promise<ImageModelResult> {
      const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
        { inlineData: { mimeType: input.sourceImage.mimeType, data: input.sourceImage.base64 } },
      ];
      for (const ref of input.referenceImages) {
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
      parts.push({ text: input.prompt });

      const base64 = await callGemini(parts, input.width, input.height, input.onRetry);
      return { base64 };
    },

    async inpaint(input: InpaintInput): Promise<InpaintResult> {
      const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
        { inlineData: { mimeType: input.maskOverlayImage.mimeType, data: input.maskOverlayImage.base64 } },
      ];
      for (const ref of input.referenceImages) {
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
      parts.push({ text: input.prompt });

      const generatedBase64 = await callGemini(parts, input.width, input.height, input.onRetry);
      const generatedBuffer = Buffer.from(generatedBase64, "base64");

      if (input.rawMaskBase64 && !input.hasSceneChange) {
        const maskBuffer = Buffer.from(input.rawMaskBase64, "base64");
        const buffer = await compositeWithMask(input.sourceBuffer, generatedBuffer, maskBuffer);
        return { buffer, mimeType: "image/webp" };
      }

      const buffer = await sharp(generatedBuffer)
        .resize(input.width, input.height, { fit: "fill" })
        .webp({ quality: 90 })
        .toBuffer();
      return { buffer, mimeType: "image/webp" };
    },

    friendlyError(err: unknown): string {
      return friendlyGeminiError(err);
    },
  };
}

export const geminiProvider = createGeminiProvider({
  name: "gemini",
  modelId: "gemini-3.1-flash-image-preview",
});

export const geminiProProvider = createGeminiProvider({
  name: "gemini-pro",
  modelId: "gemini-3-pro-image-preview",
});
