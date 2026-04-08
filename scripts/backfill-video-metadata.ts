/**
 * Backfill actual_duration_seconds, actual_fps, actual_width, actual_height
 * on existing completed video_generations rows by probing the stored MP4
 * via @remotion/media-parser.
 *
 * Run once after the 20260408000001_finalize_video migration.
 *
 * Usage:
 *   npx tsx scripts/backfill-video-metadata.ts
 *   npx tsx scripts/backfill-video-metadata.ts --limit 10
 *   npx tsx scripts/backfill-video-metadata.ts --dry-run
 *   npx tsx scripts/backfill-video-metadata.ts --force   (re-probe even if already set)
 */

import { createClient } from "@supabase/supabase-js";
import { parseMedia } from "@remotion/media-parser";
import * as fs from "fs";
import * as path from "path";

// Load env from .env.local (same pattern as other scripts in this folder)
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
const BUCKET = "videos";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

async function main() {
  let query = supabase
    .from("video_generations")
    .select("id, storage_path, actual_duration_seconds")
    .eq("status", "completed")
    .not("storage_path", "is", null);

  if (!force) {
    query = query.is("actual_duration_seconds", null);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("Failed to fetch rows:", error);
    process.exit(1);
  }

  const targets = (rows ?? []).slice(0, isFinite(limit) ? limit : undefined);
  console.log(`Found ${rows?.length ?? 0} candidate row(s); processing ${targets.length}.`);
  if (dryRun) console.log("(dry run — no DB writes)");

  let ok = 0;
  let failed = 0;

  for (const row of targets) {
    if (!row.storage_path) continue;

    const { data: urlData, error: urlErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY_SECONDS);

    if (urlErr || !urlData?.signedUrl) {
      console.warn(`  [${row.id}] failed to sign URL:`, urlErr?.message);
      failed++;
      continue;
    }

    try {
      const probed = await parseMedia({
        src: urlData.signedUrl,
        fields: {
          slowDurationInSeconds: true,
          fps: true,
          dimensions: true,
        },
        acknowledgeRemotionLicense: true,
      });

      const update = {
        actual_duration_seconds: probed.slowDurationInSeconds ?? null,
        actual_fps: probed.fps ?? null,
        actual_width: probed.dimensions?.width ?? null,
        actual_height: probed.dimensions?.height ?? null,
      };

      console.log(
        `  [${row.id}] ${update.actual_width}x${update.actual_height} @ ${update.actual_fps}fps, ${update.actual_duration_seconds?.toFixed(2)}s`
      );

      if (!dryRun) {
        const { error: updErr } = await supabase
          .from("video_generations")
          .update(update)
          .eq("id", row.id);
        if (updErr) {
          console.warn(`    DB update failed:`, updErr.message);
          failed++;
          continue;
        }
      }
      ok++;
    } catch (err) {
      console.warn(`  [${row.id}] parseMedia failed:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone. ok=${ok} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
