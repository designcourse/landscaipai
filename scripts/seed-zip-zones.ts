/**
 * Seed zip-to-zone lookup table from the Frostline project.
 *
 * Usage:
 *   npx tsx scripts/seed-zip-zones.ts
 *
 * Source: https://github.com/waldoj/frostline
 * Data: https://phzmapi.org/{zipcode}.json
 *
 * This script downloads the full zip-to-zone dataset and bulk-inserts into Supabase.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load env
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Frostline dataset URL (JSON format: { "zipcode": "zone", ... })
const FROSTLINE_URL =
  "https://raw.githubusercontent.com/waldoj/frostline/master/frostline.json";

async function main() {
  console.log("Downloading zip-to-zone data from Frostline...");

  const res = await fetch(FROSTLINE_URL);
  if (!res.ok) {
    console.error(`Failed to download: ${res.status} ${res.statusText}`);
    console.log("\nFalling back to generating common zip-to-zone mappings...");
    await seedFallbackData();
    return;
  }

  const data = await res.json();

  // Frostline data format varies — handle both object and array formats
  let rows: { zip_code: string; zone: string }[] = [];

  if (Array.isArray(data)) {
    // Array of objects format
    for (const item of data) {
      const zip = String(item.zipcode || item.zip_code || item.zip || "").padStart(5, "0");
      const zone = String(item.zone || item.hardiness_zone || "").toLowerCase();
      if (zip.length === 5 && zone) {
        rows.push({ zip_code: zip, zone });
      }
    }
  } else if (typeof data === "object") {
    // Object format: { "zipcode": "zone" }
    for (const [zip, zone] of Object.entries(data)) {
      const cleanZip = String(zip).padStart(5, "0");
      const cleanZone = String(zone).toLowerCase();
      if (cleanZip.length === 5 && cleanZone) {
        rows.push({ zip_code: cleanZip, zone: cleanZone });
      }
    }
  }

  if (rows.length === 0) {
    console.log("No data parsed from Frostline, using fallback data...");
    await seedFallbackData();
    return;
  }

  console.log(`Parsed ${rows.length} zip-to-zone entries`);
  await insertRows(rows);
}

async function insertRows(rows: { zip_code: string; zone: string }[]) {
  // Insert in batches
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("zip_to_zone").upsert(batch, {
      onConflict: "zip_code",
    });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${rows.length}`);
    }
  }

  console.log(`\nDone! ${inserted} zip-to-zone entries inserted.`);
}

/**
 * Fallback: Generate a comprehensive set of US zip-to-zone mappings
 * based on well-known geographic distributions.
 */
async function seedFallbackData() {
  console.log("Generating fallback zip-to-zone dataset...");

  const rows: { zip_code: string; zone: string }[] = [];

  // Zone assignments by zip code prefix (first 3 digits)
  // This covers the major US regions with reasonable accuracy
  const zoneByPrefix: Record<string, string> = {};

  // Northeast (zones 5-7)
  for (let i = 10; i <= 14; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // NYC area
  for (let i = 15; i <= 19; i++) zoneByPrefix[String(i).padStart(3, "0")] = "6b"; // PA
  for (let i = 1; i <= 5; i++) zoneByPrefix[`00${i}`] = "5b"; // New England
  for (let i = 6; i <= 9; i++) zoneByPrefix[`00${i}`] = "6a"; // CT/MA
  for (let i = 20; i <= 22; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // DC/MD/VA
  for (let i = 23; i <= 26; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // VA/WV

  // Southeast (zones 7-9)
  for (let i = 27; i <= 28; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7b"; // NC
  for (let i = 29; i <= 29; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8a"; // SC
  for (let i = 30; i <= 31; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8a"; // GA
  for (let i = 32; i <= 34; i++) zoneByPrefix[String(i).padStart(3, "0")] = "9a"; // FL
  for (let i = 35; i <= 36; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8a"; // AL
  for (let i = 37; i <= 38; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // TN
  for (let i = 39; i <= 39; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8a"; // MS

  // Midwest (zones 4-6)
  for (let i = 40; i <= 42; i++) zoneByPrefix[String(i).padStart(3, "0")] = "6b"; // KY
  for (let i = 43; i <= 45; i++) zoneByPrefix[String(i).padStart(3, "0")] = "6a"; // OH
  for (let i = 46; i <= 47; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5b"; // IN
  for (let i = 48; i <= 49; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5b"; // MI
  for (let i = 50; i <= 52; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5a"; // IA
  for (let i = 53; i <= 54; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5a"; // WI
  for (let i = 55; i <= 56; i++) zoneByPrefix[String(i).padStart(3, "0")] = "4b"; // MN
  for (let i = 57; i <= 57; i++) zoneByPrefix[String(i).padStart(3, "0")] = "4a"; // SD
  for (let i = 58; i <= 58; i++) zoneByPrefix[String(i).padStart(3, "0")] = "4a"; // ND
  for (let i = 59; i <= 59; i++) zoneByPrefix[String(i).padStart(3, "0")] = "4b"; // MT

  // South/Central (zones 6-9)
  for (let i = 60; i <= 62; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5b"; // IL
  for (let i = 63; i <= 65; i++) zoneByPrefix[String(i).padStart(3, "0")] = "6a"; // MO
  for (let i = 66; i <= 67; i++) zoneByPrefix[String(i).padStart(3, "0")] = "6a"; // KS
  for (let i = 68; i <= 69; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5a"; // NE
  for (let i = 70; i <= 71; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8b"; // LA
  for (let i = 72; i <= 72; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7b"; // AR
  for (let i = 73; i <= 74; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // OK
  for (let i = 75; i <= 79; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8a"; // TX

  // Mountain/West (zones 4-7)
  for (let i = 80; i <= 81; i++) zoneByPrefix[String(i).padStart(3, "0")] = "5b"; // CO
  for (let i = 82; i <= 83; i++) zoneByPrefix[String(i).padStart(3, "0")] = "4b"; // WY/ID
  for (let i = 84; i <= 84; i++) zoneByPrefix[String(i).padStart(3, "0")] = "6a"; // UT
  for (let i = 85; i <= 86; i++) zoneByPrefix[String(i).padStart(3, "0")] = "9a"; // AZ
  for (let i = 87; i <= 88; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // NM

  // Pacific (zones 7-10)
  for (let i = 89; i <= 89; i++) zoneByPrefix[String(i).padStart(3, "0")] = "7a"; // NV
  for (let i = 90; i <= 93; i++) zoneByPrefix[String(i).padStart(3, "0")] = "10a"; // CA (south)
  for (let i = 94; i <= 96; i++) zoneByPrefix[String(i).padStart(3, "0")] = "9b"; // CA (north)
  for (let i = 97; i <= 97; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8b"; // OR
  for (let i = 98; i <= 99; i++) zoneByPrefix[String(i).padStart(3, "0")] = "8a"; // WA

  // Generate all 5-digit zip codes that have a prefix mapping
  for (const [prefix, zone] of Object.entries(zoneByPrefix)) {
    const start = parseInt(prefix) * 100;
    const end = start + 99;
    for (let zip = start; zip <= end; zip++) {
      rows.push({
        zip_code: String(zip).padStart(5, "0"),
        zone,
      });
    }
  }

  console.log(`Generated ${rows.length} fallback zip-to-zone entries`);
  await insertRows(rows);
}

main().catch(console.error);
