import { ACTIVE_IMAGE_MODEL } from "./config";
import { geminiProvider, geminiProProvider } from "./gemini";
import { openaiProvider } from "./openai";
import type { ImageModelProvider } from "./types";

export type ImageModelName = "gemini" | "gemini-pro" | "openai";

export const IMAGE_MODEL_LABELS: Record<ImageModelName, string> = {
  gemini: "Nano Banana 2",
  "gemini-pro": "Nano Banana Pro",
  openai: "OpenAI Image 2.0",
};

export function getImageModel(name?: string | null): ImageModelProvider {
  const choice = (name ?? ACTIVE_IMAGE_MODEL) as ImageModelName;
  switch (choice) {
    case "openai":
      return openaiProvider;
    case "gemini-pro":
      return geminiProProvider;
    case "gemini":
    default:
      return geminiProvider;
  }
}

export type {
  GenerateInput,
  ImageModelProvider,
  ImageModelResult,
  InlineImage,
  InpaintInput,
  InpaintResult,
} from "./types";
