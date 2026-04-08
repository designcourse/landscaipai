import { Config } from "@remotion/cli/config";
import * as fs from "fs";
import * as path from "path";

/**
 * Remotion configuration. The entry point is remotion/index.ts which
 * registers the FinalizeVideo composition. Studio + Lambda deploy
 * scripts both pick up these settings automatically.
 */

// Load .env.local manually — the Remotion CLI is a standalone Node process
// and does NOT auto-load Next.js's .env.local. Without this, every
// `npx remotion lambda ...` command would fail with "AWS_ACCESS_KEY_ID
// not set" even though it's in .env.local.
//
// Also bridge our REMOTION_-prefixed vars to the standard AWS_ var names
// that @remotion/lambda actually looks for.
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

if (process.env.REMOTION_AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
}
if (
  process.env.REMOTION_AWS_SECRET_ACCESS_KEY &&
  !process.env.AWS_SECRET_ACCESS_KEY
) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
}
if (process.env.REMOTION_AWS_REGION && !process.env.AWS_REGION) {
  process.env.AWS_REGION = process.env.REMOTION_AWS_REGION;
}

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("./remotion/index.ts");
