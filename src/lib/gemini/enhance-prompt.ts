import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const VISION_MODEL = "gemini-2.5-flash";

/**
 * Analyzes the source image and enhances the user's prompt to be more
 * descriptive and context-aware. This helps the image generation model
 * produce results that integrate naturally with the existing scene.
 *
 * Returns the enhanced prompt, or the original if enhancement fails.
 */
export async function enhancePrompt(
  imageBase64: string,
  mimeType: string,
  userPrompt: string,
  isInpaint: boolean
): Promise<string> {
  try {
    const systemInstruction = isInpaint
      ? `You are a prompt engineer for an AI landscape editing tool. The user has selected a region of a photo to edit and provided a brief prompt. Your job is to expand their prompt into a detailed, precise instruction that will produce a natural-looking result.

Analyze the photo carefully. Note:
- The lighting conditions (time of day, overcast/sunny, shadow directions, color temperature)
- The scale of objects (how tall the house is, distance to background elements)
- What elements surround the edit area (fences, trees, lawn, structures)
- The overall color palette and mood of the photo

Then rewrite the user's prompt to include:
1. Exactly where in the scene the new element should go, referencing existing landmarks
2. What existing elements must be preserved (fences, paths, trees, structures)
3. The correct scale of new elements relative to the house/structures
4. Lighting/color instructions to match the existing scene
5. Perspective/depth instructions

Keep it under 3-4 sentences. Output ONLY the enhanced prompt, nothing else.`
      : `You are a prompt engineer for an AI landscape design tool. The user has provided a photo of a property and a brief prompt describing what they want changed. Your job is to expand their prompt into a detailed, precise instruction.

Analyze the photo carefully. Note:
- The lighting conditions, time of day, weather
- The architecture style and materials
- The current landscaping, yard layout, structures
- The scale and proportions of the scene

Then rewrite the user's prompt to include:
1. Specific placement instructions referencing existing elements in the photo
2. What existing elements must be preserved exactly as they are
3. Correct scale of new elements relative to the house/structures
4. Lighting and color palette that matches the existing scene

Keep it under 3-4 sentences. Output ONLY the enhanced prompt, nothing else.`;

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: `User's prompt: "${userPrompt}"\n\nEnhance this prompt based on the photo.` },
          ],
        },
      ],
      config: {
        systemInstruction,
      },
    });

    const enhanced = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (enhanced && enhanced.length > userPrompt.length) {
      return enhanced;
    }
    return userPrompt;
  } catch {
    // If enhancement fails, just use the original prompt
    return userPrompt;
  }
}
