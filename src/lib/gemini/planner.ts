import { GoogleGenAI } from "@google/genai";
import { STYLE_PRESETS } from "./prompts";

// Vision/reasoning models for the planner, newest first. "gemini-3.5-flash" is
// GA on the Developer API and handles image input + JSON output (verified
// against our key); "gemini-3-flash" does NOT exist (404). The chain falls back
// if a model is unavailable.
const PLANNER_MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface PlannedConcept {
  tier: string;
  name: string;
  prompt: string;
}

function plannerInstruction(styleLine: string, customLine: string, reqLine: string): string {
  return `You are an expert residential landscape designer helping a homeowner improve the FRONT YARD in the attached photo. They want a tasteful improvement and they care about budget.${styleLine}${customLine}${reqLine}

Analyze the photo, then propose THREE concepts at three budget tiers:
1. "Budget-Friendly": simple, high-impact, low-cost — fresh mulch beds with clean edging, a few foundation shrubs, some perennials/flowers, maybe one small tree. Modest but noticeably nicer.
2. "Intermediate": a clear step up — fuller layered foundation beds, a defined planting bed along the walkway/porch, a flowering tree or two, more variety and color, simple bed borders. Sensible mid-range cost.
3. "Premium": next-level and very nice but STILL tasteful and traditional, NOT wild or contemporary — a natural stone or paver walkway, stone/steel bed edging, layered professional planting with evergreen structure + seasonal color, a focal specimen tree, and a few accent boulders. A classic "wow".

For EACH tier, return a complete, specific, photorealistic image-EDIT instruction tailored to THIS exact photo: preserve the house, porch, driveway, mature trees and any structures exactly; keep the identical camera angle and aspect ratio. Prefer common, traditional plants (boxwood, hydrangea, hostas, daylilies, ornamental grasses, arborvitae, a flowering dogwood/crabapple, etc.) — nothing exotic.

Return ONLY valid JSON (no markdown fences):
{"analysis":"1-2 sentences on the house, yard, and what to preserve","concepts":[{"tier":"Budget-Friendly","name":"short label","prompt":"..."},{"tier":"Intermediate","name":"short label","prompt":"..."},{"tier":"Premium","name":"short label","prompt":"..."}]}`;
}

function extractJson(t: string): string {
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b >= 0 ? t.slice(a, b + 1) : t;
}

/**
 * Analyze the source photo and return budget-tiered, photo-tailored design
 * concepts (one image-edit prompt per tier). The caller appends aspect-ratio /
 * preservation guardrails before sending each prompt to the image model.
 *
 * Throws if no model produces usable concepts — callers should catch and fall
 * back to the deterministic template prompt.
 */
export async function planConcepts(input: {
  base64: string;
  mimeType: string;
  style?: string | null;
  customPrompt?: string;
  timeOfDay?: string;
  season?: string;
  weather?: string;
  selectedPlants?: { common_name: string }[];
  selectedHardscape?: { common_name: string }[];
  hasReferenceAttachments?: boolean;
}): Promise<PlannedConcept[]> {
  const preset = input.style ? STYLE_PRESETS.find((p) => p.id === input.style) : null;
  const styleLine = preset
    ? ` Lean the aesthetic toward the "${preset.name}" style (${preset.description}) across all three tiers, while keeping each tier appropriate to its budget.`
    : "";
  const customLine = input.customPrompt?.trim()
    ? ` The homeowner specifically asked: "${input.customPrompt.trim()}" — honor this in every tier, scaling the execution to each budget.`
    : "";

  const settings: string[] = [];
  if (input.timeOfDay) settings.push(`time of day: ${input.timeOfDay}`);
  if (input.season) settings.push(`season: ${input.season}`);
  if (input.weather) settings.push(`weather: ${input.weather}`);
  const plantNames = (input.selectedPlants ?? []).map((p) => p.common_name).filter(Boolean);
  const hardNames = (input.selectedHardscape ?? []).map((h) => h.common_name).filter(Boolean);
  const reqBits: string[] = [];
  if (settings.length) reqBits.push(`render every concept at ${settings.join(", ")}`);
  if (plantNames.length) reqBits.push(`prominently feature the homeowner's chosen plants (${plantNames.join(", ")})`);
  if (hardNames.length) reqBits.push(`include these hardscape elements (${hardNames.join(", ")})`);
  if (input.hasReferenceAttachments) reqBits.push("match the materials and style shown in the homeowner's attached reference images");
  const reqLine = reqBits.length ? ` IMPORTANT — honor ALL of these in EVERY concept: ${reqBits.join("; ")}.` : "";

  const instruction = plannerInstruction(styleLine, customLine, reqLine);

  let lastErr: unknown;
  for (const model of PLANNER_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: input.mimeType, data: input.base64 } },
              { text: instruction },
            ],
          },
        ],
        config: { responseMimeType: "application/json", temperature: 0.7 },
      });
      const text =
        res.text ?? (res.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join("");
      const json = JSON.parse(extractJson(text));
      const concepts: PlannedConcept[] = (json.concepts ?? []).filter(
        (c: Partial<PlannedConcept>) => c && typeof c.prompt === "string" && c.prompt.trim(),
      );
      if (concepts.length >= 1) return concepts;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("planner returned no concepts");
}
