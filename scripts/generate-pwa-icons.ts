/**
 * Generate PWA icons from the leaf mark in public/assets/logo.png.
 *
 * Extracts the leaf mark (cols 0-44 of the wordmark), recolors it white,
 * and composites it onto a #0F8000 green square at multiple sizes.
 *
 * Outputs to public/icons/:
 *   - icon-192.png            (Android home screen)
 *   - icon-512.png            (Android splash, large)
 *   - icon-512-maskable.png   (Android adaptive icons, extra padding in safe zone)
 *   - apple-touch-icon.png    (iOS home screen, 180x180)
 *   - favicon-32.png          (browser tab)
 *   - leaf-mark-white.png     (bare white mark on transparent, 128x128 — for UI use)
 *
 * Usage:
 *   npx tsx scripts/generate-pwa-icons.ts
 */

import sharp from "sharp";
import * as path from "path";

const SOURCE = path.resolve(process.cwd(), "public/assets/logo.png");
const OUT_DIR = path.resolve(process.cwd(), "public/icons");

const BG = { r: 15, g: 128, b: 0, alpha: 1 }; // #0F8000
const LEAF_RIGHT_EDGE = 45; // leaf mark spans cols 0-44 in the 278x38 logo

async function extractLeafWhite(): Promise<{ buffer: Buffer; width: number; height: number }> {
  // 1. Crop just the leaf mark from the logo
  const cropped = sharp(SOURCE).extract({ left: 0, top: 0, width: LEAF_RIGHT_EDGE, height: 38 });
  const { data, info } = await cropped.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 2. Recolor every non-transparent pixel to white, preserving alpha for anti-aliasing
  const recolored = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    recolored[i] = 255;
    recolored[i + 1] = 255;
    recolored[i + 2] = 255;
    recolored[i + 3] = a;
  }

  // 3. Trim transparent edges to get a tight bounding box
  const trimmed = await sharp(recolored, { raw: { width, height, channels: 4 } })
    .png()
    .trim()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: trimmed.data,
    width: trimmed.info.width,
    height: trimmed.info.height,
  };
}

async function makeIcon(
  size: number,
  paddingRatio: number,
  outPath: string,
  leafWhite: { buffer: Buffer; width: number; height: number },
) {
  // Scale the leaf to fit within (size - 2*padding), preserving aspect ratio
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const scaleW = inner / leafWhite.width;
  const scaleH = inner / leafWhite.height;
  const scale = Math.min(scaleW, scaleH);
  const targetW = Math.round(leafWhite.width * scale);
  const targetH = Math.round(leafWhite.height * scale);

  const resizedLeaf = await sharp(leafWhite.buffer)
    .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  // Center the leaf on a green square
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      {
        input: resizedLeaf,
        left: Math.round((size - targetW) / 2),
        top: Math.round((size - targetH) / 2),
      },
    ])
    .png()
    .toFile(outPath);

  console.log(`  ${path.basename(outPath)} (${size}×${size}, padding ${(paddingRatio * 100).toFixed(0)}%)`);
}

async function main() {
  await sharp(SOURCE).metadata(); // sanity check source exists
  const fs = await import("fs");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Extracting leaf mark from logo...");
  const leaf = await extractLeafWhite();
  console.log(`  leaf bounds: ${leaf.width}×${leaf.height} (white on transparent)`);

  console.log("Generating icons:");
  // Standard icons: ~15% padding (mark looks centered, breathes)
  await makeIcon(192, 0.15, path.join(OUT_DIR, "icon-192.png"), leaf);
  await makeIcon(512, 0.15, path.join(OUT_DIR, "icon-512.png"), leaf);
  await makeIcon(180, 0.15, path.join(OUT_DIR, "apple-touch-icon.png"), leaf);
  await makeIcon(32, 0.1, path.join(OUT_DIR, "favicon-32.png"), leaf);

  // Maskable icon: Android adaptive icons crop to a circle/squircle/etc.
  // Safe zone is the inner 80% — so we need ~20% padding on all sides (40% total).
  // Source spec: https://web.dev/maskable-icon/
  await makeIcon(512, 0.22, path.join(OUT_DIR, "icon-512-maskable.png"), leaf);

  // Bare white mark on transparent — for UI use (e.g., Generate button).
  // Resize the trimmed leaf to fit a 128x128 square with no background, preserving aspect ratio.
  const markSize = 128;
  const scaleW = markSize / leaf.width;
  const scaleH = markSize / leaf.height;
  const scale = Math.min(scaleW, scaleH);
  const markW = Math.round(leaf.width * scale);
  const markH = Math.round(leaf.height * scale);
  await sharp({
    create: {
      width: markSize,
      height: markSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(leaf.buffer)
          .resize(markW, markH, { kernel: sharp.kernel.lanczos3 })
          .png()
          .toBuffer(),
        left: Math.round((markSize - markW) / 2),
        top: Math.round((markSize - markH) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, "leaf-mark-white.png"));
  console.log(`  leaf-mark-white.png (${markSize}×${markSize}, white on transparent)`);

  console.log("\nDone. Icons written to public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
