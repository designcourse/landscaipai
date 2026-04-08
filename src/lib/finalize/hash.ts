import { createHash } from "crypto";

/**
 * Deterministic JSON stringification — sorts object keys recursively so
 * `{a:1,b:2}` and `{b:2,a:1}` produce the same string. This is required
 * for the input_props_hash cache key on video_finalizations: identical
 * inputs (regardless of object key order) should produce identical hashes.
 */
function canonicalStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * SHA-256 hash of a canonicalized JSON value. Used as the cache key on
 * video_finalizations rows so identical re-finalize requests can return
 * the existing rendered MP4 instead of paying for a duplicate Lambda render.
 *
 * IMPORTANT: do not include signed URLs (which contain expiring tokens)
 * in the value passed to this function. Strip them out and hash only the
 * stable identifying fields.
 */
export function hashInputProps(value: unknown): string {
  const canonical = canonicalStringify(value);
  return createHash("sha256").update(canonical).digest("hex");
}
