/**
 * Generate thumbnails for library items from their full-size images.
 *
 * Downloads from plant-library bucket, resizes with sharp, uploads as
 * thumbs/{category}/{slug}.webp, updates thumbnail_path in DB.
 *
 * Usage:
 *   npx tsx scripts/generate-thumbnails.ts
 *   npx tsx scripts/generate-thumbnails.ts --category "Annuals"
 *   npx tsx scripts/generate-thumbnails.ts --limit 10
 *   npx tsx scripts/generate-thumbnails.ts --dry-run
 *   npx tsx scripts/generate-thumbnails.ts --size 400   (default 300)
 */

import { createClient } from "@supabase/supabase-js";
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "plant-library";

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
const catIdx = args.indexOf("--category");
const categoryFilter = catIdx !== -1 ? args[catIdx + 1] : null;
const sizeIdx = args.indexOf("--size");
const THUMB_SIZE = sizeIdx !== -1 ? parseInt(args[sizeIdx + 1]) : 300;

async function main() {
  console.log(`Thumbnail size: ${THUMB_SIZE}x${THUMB_SIZE}\n`);

  // Fetch items that have a full image but no thumbnail yet (or all if --force)
  let query = supabase
    .from("library_items")
    .select("id, common_name, category, image_path, thumbnail_path")
    .not("image_path", "is", null)
    .order("category")
    .order("common_name");

  if (!force) {
    query = query.is("thumbnail_path", null);
  }

  if (categoryFilter) {
    query = query.eq("category", categoryFilter);
    console.log(`Category: "${categoryFilter}"\n`);
  }

  const { data: items, error } = await query;
  if (error) { console.error("Failed to fetch items:", error.message); process.exit(1); }
  if (!items?.length) { console.log("All items already have thumbnails."); return; }

  const toProcess = items.slice(0, limit);
  console.log(`${toProcess.length} items to process${dryRun ? " (DRY RUN)" : ""}\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const tag = `[${i + 1}/${toProcess.length}]`;
    const thumbPath = `thumbs/${item.image_path}`;

    process.stdout.write(`${tag} ${item.common_name} `);

    if (dryRun) { console.log(`→ ${thumbPath}`); continue; }

    try {
      // Download full image
      const { data: fileData, error: dlError } = await supabase.storage
        .from(BUCKET)
        .download(item.image_path!);

      if (dlError || !fileData) {
        console.log(`✗ download: ${dlError?.message ?? "no data"}`);
        failed++;
        continue;
      }

      const fullBuf = Buffer.from(await fileData.arrayBuffer());

      // Resize to thumbnail
      const thumbBuf = await sharp(fullBuf)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, thumbBuf, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });

      if (uploadError) {
        console.log(`✗ upload: ${uploadError.message}`);
        failed++;
        continue;
      }

      // Update DB
      await supabase.from("library_items").update({
        thumbnail_path: thumbPath,
      }).eq("id", item.id);

      const ratio = ((thumbBuf.length / fullBuf.length) * 100).toFixed(0);
      console.log(`✓ ${(fullBuf.length / 1024).toFixed(0)}KB → ${(thumbBuf.length / 1024).toFixed(0)}KB (${ratio}%)`);
      success++;
    } catch (err: unknown) {
      console.log(`✗ ${err instanceof Error ? err.message : "error"}`);
      failed++;
    }
  }

  console.log(`\nDone! ${success} thumbnails created, ${failed} failed`);
}

main().catch(console.error);
