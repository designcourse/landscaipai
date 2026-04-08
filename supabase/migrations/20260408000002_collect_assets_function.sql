-- Migration: collect_assets_for_video function
-- Walks both start_generation_id and end_generation_id parent chains
-- of a video_generations row, collects all selected_library_items,
-- dedupes by id, and returns them ordered by first-appearance depth.
--
-- Used by the Finalize Video feature to populate the asset cards
-- automatically based on the iterative generation history of the video's
-- source frames.

CREATE OR REPLACE FUNCTION public.collect_assets_for_video(
  p_video_generation_id UUID
)
RETURNS TABLE(id TEXT, name TEXT, thumbnail_url TEXT)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE seeds AS (
    -- Both ends of the video — either may be null (if the source is an
    -- original photo rather than a generation).
    SELECT vg.start_generation_id AS gen_id
    FROM public.video_generations vg
    WHERE vg.id = p_video_generation_id
      AND vg.start_generation_id IS NOT NULL
    UNION
    SELECT vg.end_generation_id
    FROM public.video_generations vg
    WHERE vg.id = p_video_generation_id
      AND vg.end_generation_id IS NOT NULL
  ),
  chain AS (
    -- Base case: the seed generations themselves at depth 0.
    SELECT
      g.id,
      g.parent_generation_id,
      g.selected_library_items,
      0 AS depth
    FROM public.generations g
    WHERE g.id IN (SELECT gen_id FROM seeds)

    UNION ALL

    -- Recursive case: walk up the parent chain. Hard cap at depth 20
    -- to defend against cycles (parent_generation_id has no cycle
    -- constraint at the table level).
    SELECT
      g.id,
      g.parent_generation_id,
      g.selected_library_items,
      c.depth + 1
    FROM public.generations g
    JOIN chain c ON g.id = c.parent_generation_id
    WHERE c.depth < 20
  ),
  expanded AS (
    -- Flatten each generation's selected_library_items JSONB array
    -- into one row per (generation, item) and remember the depth.
    SELECT
      item->>'id' AS id,
      item->>'name' AS name,
      item->>'thumbnail_url' AS thumbnail_url,
      depth
    FROM chain,
         jsonb_array_elements(COALESCE(selected_library_items, '[]'::jsonb)) AS item
    WHERE item->>'id' IS NOT NULL
  ),
  deduped AS (
    -- Pick the first appearance (lowest depth) of each unique asset id.
    SELECT DISTINCT ON (id)
      id, name, thumbnail_url, depth
    FROM expanded
    ORDER BY id, depth ASC
  )
  SELECT id, name, thumbnail_url
  FROM deduped
  ORDER BY depth, name;
$$;

-- Allow authenticated users to call the function. RLS on the underlying
-- tables (video_generations, generations) still applies because the
-- function is SECURITY INVOKER (the default).
GRANT EXECUTE ON FUNCTION public.collect_assets_for_video(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collect_assets_for_video(UUID) TO service_role;
