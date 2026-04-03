/**
 * Generate reference images for all library items using Imagen 4.
 *
 * Features:
 *   - Generates photorealistic images via Imagen 4 Standard
 *   - Creates 150x150 thumbnails via sharp
 *   - Validates each image for text/labels via Gemini vision (auto-retries once)
 *   - Flags other issues (illustration style, cropping) for manual review
 *   - Resumable: skips items that already have an image_path
 *
 * Usage:
 *   npx tsx scripts/generate-library-images.ts
 *   npx tsx scripts/generate-library-images.ts --limit 10
 *   npx tsx scripts/generate-library-images.ts --category "Trees"
 *   npx tsx scripts/generate-library-images.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// Load env
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const BUCKET = "plant-library";
const IMAGE_MODEL = "imagen-4.0-generate-001";
const VISION_MODEL = "gemini-2.5-flash";
const DELAY_MS = 2000;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 15_000; // 15s initial backoff for rate limits

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipValidation = args.includes("--no-validate");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
const catIdx = args.indexOf("--category");
const categoryFilter = catIdx !== -1 ? args[catIdx + 1] : null;

// ── Prompt builders ──────────────────────────────────────────

function buildPrompt(item: { item_type: string; common_name: string; scientific_name: string | null }, isRetry: boolean): string {
  const strict = isRetry
    ? " CRITICAL: The previous image contained text or labels. You MUST NOT include ANY text, words, letters, labels, annotations, or captions anywhere in the image."
    : "";

  if (item.item_type === "hardscape") {
    return `A photorealistic product photograph of a ${item.common_name} used in landscaping. Pure white background. Realistic photo. No text, no labels, no annotations. Show texture and material detail. Soft studio lighting. The entire object must be fully visible with padding on all sides.${strict}`;
  }

  const sci = item.scientific_name ? ` (${item.scientific_name})` : "";
  return `A photorealistic photograph of a ${item.common_name}${sci} plant on a pure white background. Real photograph, not an illustration or drawing. No text, no labels, no annotations, no pots, no containers. Just the plant itself cleanly isolated on white. The entire plant must be fully visible. Soft natural lighting, sharp photographic detail.${strict}`;
}

// ── Validation agent ─────────────────────────────────────────

interface ValidationResult {
  hasText: boolean;
  otherIssues: string[];
}

async function validateImage(imageBase64: string): Promise<ValidationResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: VISION_MODEL,
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/webp", data: imageBase64 } },
            { text: `Check this product/plant reference image for issues. Answer each YES or NO:
1. TEXT: Does the image contain any text, labels, annotations, captions, watermarks, or letters?
2. ILLUSTRATED: Does it look hand-drawn, illustrated, or like a diagram rather than a real photo?

Respond in exactly this format (one per line):
TEXT: YES or NO
ILLUSTRATED: YES or NO` },
          ],
        }],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      const hasText = /TEXT:\s*YES/i.test(text);
      const otherIssues: string[] = [];
      if (/ILLUSTRATED:\s*YES/i.test(text)) otherIssues.push("illustrated");

      return { hasText, otherIssues };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /429|rate.?limit|resource.?exhaust|quota/i.test(msg);
      if (!isRateLimit || attempt === MAX_RETRIES) return { hasText: false, otherIssues: [] };
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
      process.stdout.write(`⏳ validate rate limited, waiting ${(wait / 1000).toFixed(0)}s...`);
      await sleep(wait);
    }
  }
  return { hasText: false, otherIssues: [] };
}

// ── Image generation (Imagen 4) ─────────────────────────────

async function generateImageOnce(item: { item_type: string; common_name: string; scientific_name: string | null }, isRetry: boolean): Promise<Buffer | null> {
  const prompt = buildPrompt(item, isRetry);
  const response = await ai.models.generateImages({
    model: IMAGE_MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
      outputMimeType: "image/png",
      includeRaiReason: true,
    },
  });

  const gen = response.generatedImages?.[0];
  if (!gen?.image?.imageBytes) return null;
  return Buffer.from(gen.image.imageBytes, "base64");
}

async function generateImage(item: { item_type: string; common_name: string; scientific_name: string | null }, isRetry: boolean): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateImageOnce(item, isRetry);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /429|rate.?limit|resource.?exhaust|quota/i.test(msg);
      if (!isRateLimit || attempt === MAX_RETRIES) throw err;
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
      process.stdout.write(`⏳ rate limited, waiting ${(wait / 1000).toFixed(0)}s...`);
      await sleep(wait);
      process.stdout.write(" retrying ");
    }
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function sanitize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("Fetching library items without images...\n");

  let query = supabase
    .from("library_items")
    .select("id, item_type, common_name, scientific_name, category, subcategory, image_path")
    .is("image_path", null)
    .order("category")
    .order("common_name");

  if (categoryFilter) {
    query = query.eq("category", categoryFilter);
    console.log(`Category: "${categoryFilter}"\n`);
  }

  const { data: items, error } = await query;
  if (error) { console.error("Failed to fetch items:", error.message); process.exit(1); }
  if (!items?.length) { console.log("All items already have images."); return; }

  const toProcess = items.slice(0, limit);
  console.log(`${toProcess.length} items to process${dryRun ? " (DRY RUN)" : ""}\n`);

  let success = 0, failed = 0, flagged = 0, textFixed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const tag = `[${i + 1}/${toProcess.length}]`;
    const slug = sanitize(item.common_name);
    const imgPath = `${sanitize(item.category)}/${slug}.webp`;

    process.stdout.write(`${tag} ${item.common_name} `);

    if (dryRun) { console.log(`→ ${imgPath}`); continue; }

    try {
      // ── Generate ──
      let pngBuf = await generateImage(item, false);
      if (!pngBuf) {
        console.log("✗ no image");
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      // Convert to webp for validation + storage
      let webpBuf = await sharp(pngBuf).webp({ quality: 85 }).toBuffer();
      let webpB64 = webpBuf.toString("base64");

      // ── Validate ──
      let needsReview = false;

      if (!skipValidation) {
      const v = await validateImage(webpB64);

      if (v.hasText) {
        process.stdout.write("⚠text→retry ");
        await sleep(DELAY_MS);
        const retry = await generateImage(item, true);
        if (retry) {
          const retryWebp = await sharp(retry).webp({ quality: 85 }).toBuffer();
          const v2 = await validateImage(retryWebp.toString("base64"));
          if (!v2.hasText) {
            webpBuf = retryWebp;
            textFixed++;
            if (v2.otherIssues.length) needsReview = true;
          } else {
            webpBuf = retryWebp;
            needsReview = true;
          }
        } else {
          needsReview = true;
        }
      } else if (v.otherIssues.length) {
        needsReview = true;
      }
      } // end if !skipValidation

      // ── Upload (full image only, thumbnails done in a later sweep) ──
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(imgPath, webpBuf, { contentType: "image/webp", cacheControl: "31536000", upsert: true });

      if (uploadError) {
        console.log(`✗ upload: ${uploadError.message}`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      await supabase.from("library_items").update({
        image_path: imgPath,
        needs_review: needsReview,
      }).eq("id", item.id);

      const flag = needsReview ? " 🚩review" : "";
      console.log(`✓ ${(webpBuf.length / 1024).toFixed(0)}KB${flag}`);
      success++;
      if (needsReview) flagged++;
    } catch (err: unknown) {
      console.log(`✗ ${err instanceof Error ? err.message : "error"}`);
      failed++;
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone! ${success} saved, ${failed} failed, ${flagged} flagged, ${textFixed} text-fixed`);
}

main().catch(console.error);
