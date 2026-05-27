/* Aligns hero before/after PNGs so the house content sits at identical
   canvas coordinates, halves the resolution, and emits compressed WebP
   so the four hero frames don't dominate the page weight.

   Source PNGs (originals at ~3361x1892) stay in public/landing/.
   Aligned outputs land next to them as -aligned.webp at half-res.

   Usage: node scripts/align-hero-images.cjs
*/

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LANDING = path.join(__dirname, "..", "public", "landing");

// Half the original 3361x1892 canvas — the rendered hero stage is at
// most 1640 css px wide with a 1.75x DPR cap on the WebGL renderer,
// so 1680x946 keeps the texture sharp on every reasonable display
// while cutting the texture's pixel count by 4x before compression.
const TARGET = {
  canvasWidth: 1680,
  canvasHeight: 946,
  contentWidth: 1567,
  contentHeight: 458,
  offsetLeft: 62,
  offsetTop: 215,
};

async function align(srcName, dstName) {
  const src = path.join(LANDING, srcName);
  const dst = path.join(LANDING, dstName);
  const trimmed = await sharp(src)
    .trim({ threshold: 5 })
    .resize(TARGET.contentWidth, TARGET.contentHeight, { fit: "fill" })
    .toBuffer();
  await sharp({
    create: {
      width: TARGET.canvasWidth,
      height: TARGET.canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: trimmed, left: TARGET.offsetLeft, top: TARGET.offsetTop },
    ])
    .webp({ quality: 82, effort: 5, alphaQuality: 90 })
    .toFile(dst);
  const stat = fs.statSync(dst);
  console.log(`  ${dstName}  (${(stat.size / 1024).toFixed(0)} KB)`);
}

(async () => {
  console.log("Aligning hero frames ->");
  await align("hero-house-before.png", "hero-house-before-aligned.webp");
  await align("hero-house-after-1.png", "hero-house-after-1-aligned.webp");
  await align("hero-house-after-desert.png", "hero-house-after-desert-aligned.webp");
  await align("hero-house-after-luxe.png", "hero-house-after-luxe-aligned.webp");
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
