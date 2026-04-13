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

/** Enriched asset with full library_items attributes for the plant info card. */
export interface EnrichedAsset extends DetectedAsset {
  description: string | null;
  zone_min: string | null;
  zone_max: string | null;
  height_min_ft: number | null;
  height_max_ft: number | null;
  spread_min_ft: number | null;
  spread_max_ft: number | null;
  sun_requirement: string | null;
  water_needs: string | null;
  growth_rate: string | null;
  maintenance_level: string | null;
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

/**
 * Enriches detected assets with full library_items attributes by matching
 * on common_name. Assets not found in library_items get null attributes.
 */
export async function enrichAssets(
  client: SupabaseClient,
  assets: DetectedAsset[]
): Promise<EnrichedAsset[]> {
  if (assets.length === 0) return [];

  const names = assets.map((a) => a.name);
  const { data: items, error } = await client
    .from("library_items")
    .select(
      "common_name, description, zone_min, zone_max, height_min_ft, height_max_ft, spread_min_ft, spread_max_ft, sun_requirement, water_needs, growth_rate, maintenance_level"
    )
    .in("common_name", names);

  if (error) {
    console.error("enrichAssets failed:", error);
  }

  const byName = new Map(
    (items ?? []).map((item) => [item.common_name, item])
  );

  return assets.map((asset) => {
    const info = byName.get(asset.name);
    return {
      ...asset,
      description: info?.description ?? null,
      zone_min: info?.zone_min ?? null,
      zone_max: info?.zone_max ?? null,
      height_min_ft: info?.height_min_ft ?? null,
      height_max_ft: info?.height_max_ft ?? null,
      spread_min_ft: info?.spread_min_ft ?? null,
      spread_max_ft: info?.spread_max_ft ?? null,
      sun_requirement: info?.sun_requirement ?? null,
      water_needs: info?.water_needs ?? null,
      growth_rate: info?.growth_rate ?? null,
      maintenance_level: info?.maintenance_level ?? null,
    };
  });
}
