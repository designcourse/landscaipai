import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A library item that was used in one of the generations linked to a video.
 *
 * Note: in the current schema, `id` is the same as `name` (the route stores
 * `common_name` as both id and name when persisting to `selected_library_items`).
 * The `id` field is still the canonical key for dedup and selection.
 */
export interface DetectedAsset {
  id: string;
  name: string;
  thumbnail_url: string;
}

/**
 * Walks both the start and end generation parent chains for a video and
 * returns the deduplicated set of library items used across them.
 *
 * Backed by the `collect_assets_for_video` Postgres function (see migration
 * 20260408000002_collect_assets_function.sql).
 *
 * Returns an empty array on error or when no assets are found — callers
 * should always render gracefully.
 */
export async function collectAssetsForVideo(
  client: SupabaseClient,
  videoGenerationId: string
): Promise<DetectedAsset[]> {
  const { data, error } = await client.rpc("collect_assets_for_video", {
    p_video_generation_id: videoGenerationId,
  });

  if (error) {
    console.error("collectAssetsForVideo failed:", error);
    return [];
  }

  return (data ?? []) as DetectedAsset[];
}
