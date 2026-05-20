/**
 * Generate PWA icons from the leaf mark in public/assets/proper-symbol.svg.
 *
 * Renders the SVG (87x74 viewBox) at each target size with sharp/libvips,
 * preserving aspect ratio and centering on a #0F8000 green square.
 * SVG source guarantees crisp output at any size — no raster upscaling artifacts.
 *
 * Outputs to public/icons/:
 *   - icon-192.png            (Android home screen)
 *   - icon-512.png            (Android splash, large)
 *   - icon-512-maskable.png   (Android adaptive icons, extra padding in safe zone)
 *   - apple-touch-icon.png    (iOS home screen, 180x180)
 *   - favicon-32.png          (browser tab)
 *   - leaf-mark-white.png     (bare white mark on transparent, 256x256 — for UI use)
 *
 * Usage:
 *   npx tsx scripts/generate-pwa-icons.ts
 */

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const SOURCE_SVG = path.resolve(process.cwd(), "public/assets/proper-symbol.svg");
const OUT_DIR = path.resolve(process.cwd(), "public/icons");

const BG = { r: 15, g: 128, b: 0, alpha: 1 }; // #0F8000

// Native viewBox of proper-symbol.svg
const SRC_W = 87;
const SRC_H = 74;

function loadWhiteSvg(): string {
  const raw = fs.readFileSync(SOURCE_SVG, "utf8");
  // Source uses fill="white" already; keep currentColor support for any future edits.
  return raw.replace(/fill="currentColor"/g, 'fill="white"');
}

async function renderLeaf(targetMax: number, svg: string): Promise<Buffer> {
  // Compute the larger dimension and use density so libvips renders at high precision
  // before sharp performs final downsampling with lanczos3.
  const scale = targetMax / Math.max(SRC_W, SRC_H);
  // Density 72 ⇒ 1 user-unit per pixel; we want SRC_W * scale pixels, so density = 72 * scale.
  // Add 4x oversample for crisp anti-aliasing on small sizes.
  const density = Math.max(72, Math.round(72 * scale * 4));
  return sharp(Buffer.from(svg), { density })
    .resize(Math.round(SRC_W * scale), Math.round(SRC_H * scale), {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function makeIcon(
  size: number,
  paddingRatio: number,
  outPath: string,
  svg: string,
) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const leafBuf = await renderLeaf(inner, svg);
  const meta = await sharp(leafBuf).metadata();
  const w = meta.width ?? inner;
  const h = meta.height ?? inner;

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
        input: leafBuf,
        left: Math.round((size - w) / 2),
        top: Math.round((size - h) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`  ${path.basename(outPath)} (${size}×${size}, padding ${(paddingRatio * 100).toFixed(0)}%)`);
}

async function main() {
  if (!fs.existsSync(SOURCE_SVG)) {
    throw new Error(`Source SVG not found at ${SOURCE_SVG}`);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const svg = loadWhiteSvg();
  console.log("Rendering leaf mark from SVG…");

  console.log("Generating icons:");
  // Standard icons: ~15% padding (mark looks centered, breathes)
  await makeIcon(192, 0.15, path.join(OUT_DIR, "icon-192.png"), svg);
  await makeIcon(512, 0.15, path.join(OUT_DIR, "icon-512.png"), svg);
  await makeIcon(180, 0.15, path.join(OUT_DIR, "apple-touch-icon.png"), svg);
  await makeIcon(32, 0.1, path.join(OUT_DIR, "favicon-32.png"), svg);

  // Maskable icon: Android adaptive icons crop to a circle/squircle/etc.
  // Safe zone is the inner 80% — so we need ~20% padding on all sides (40% total).
  // Source spec: https://web.dev/maskable-icon/
  await makeIcon(512, 0.22, path.join(OUT_DIR, "icon-512-maskable.png"), svg);

  // Bare white mark on transparent — for UI use (e.g., Generate button).
  const markSize = 256;
  const leafBuf = await renderLeaf(markSize, svg);
  const meta = await sharp(leafBuf).metadata();
  const w = meta.width ?? markSize;
  const h = meta.height ?? markSize;
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
        input: leafBuf,
        left: Math.round((markSize - w) / 2),
        top: Math.round((markSize - h) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "leaf-mark-white.png"));
  console.log(`  leaf-mark-white.png (${markSize}×${markSize}, white on transparent)`);

  console.log("\nDone. Icons written to public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
