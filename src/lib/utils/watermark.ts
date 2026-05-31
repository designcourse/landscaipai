import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Free-tier watermark: the Landscaip leaf mark, centered, white, barely there.
const WATERMARK_OPACITY = 0.2; // ~20% white — visible but unobtrusive
const WATERMARK_WIDTH_RATIO = 0.42; // mark width relative to the image width

let cachedMark: Buffer | null = null;
async function loadMark(): Promise<Buffer> {
  if (!cachedMark) {
    cachedMark = await readFile(
      path.join(process.cwd(), "public", "icons", "leaf-mark-white.png"),
    );
  }
  return cachedMark;
}

/**
 * Bake the Landscaip leaf mark — centered, white, ~20% opacity — into an image.
 * Used as the free-tier (non-paying) watermark + upgrade hook, applied
 * server-side before upload so it can't be stripped client-side. Returns WebP.
 *
 * Fails open: on any error it returns the original buffer unchanged, so a
 * watermarking hiccup never costs the user their (credit-charged) generation.
 */
export async function applyFreeTierWatermark(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const base = sharp(imageBuffer);
    const meta = await base.metadata();
    const width = meta.width ?? 1024;
    const markWidth = Math.max(96, Math.round(width * WATERMARK_WIDTH_RATIO));

    // Resize the white mark, then multiply its alpha channel down to ~20% so it
    // reads as a faint overlay (operating on the raw alpha is reliable; the
    // dest-in blend trick does not consistently scale opacity in libvips).
    const { data: markData, info: markInfo } = await sharp(await loadMark())
      .resize({ width: markWidth })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < markData.length; i += 4) {
      markData[i] = Math.round(markData[i] * WATERMARK_OPACITY);
    }
    const mark = await sharp(markData, {
      raw: { width: markInfo.width, height: markInfo.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return await base
      .composite([{ input: mark, gravity: "center" }])
      .webp({ quality: 90 })
      .toBuffer();
  } catch (err) {
    console.warn(
      "[watermark] failed; using unwatermarked image:",
      err instanceof Error ? err.message : err,
    );
    return imageBuffer;
  }
}
