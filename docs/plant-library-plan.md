# Plant & Hardscape Reference Library — Implementation Plan

## Context

Landscaip AI users currently type free-text prompts to describe what plants and materials they want in their landscape designs. This is limited because most users don't know plant names, don't know what grows in their climate zone, and can't visualize what specific plants look like. A curated reference library with images lets users browse, discover, and select specific plants and hardscape materials that are appropriate for their zone — and those selections get injected into the Gemini prompt for more accurate, realistic generations.

---

## Phase 1: Database & Data Foundation

### 1A. Migration: `library_items` table + project zone fields

**File:** `supabase/migrations/20260329000001_plant_library.sql`

```sql
-- Add zone fields to projects
ALTER TABLE public.projects
  ADD COLUMN zip_code TEXT,
  ADD COLUMN hardiness_zone TEXT;

-- Zip-to-zone lookup (seeded separately)
CREATE TABLE public.zip_to_zone (
  zip_code TEXT PRIMARY KEY,
  zone TEXT NOT NULL
);

-- Unified library items table (plants + hardscape)
CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('plant', 'hardscape')),
  common_name TEXT NOT NULL,
  scientific_name TEXT,             -- NULL for hardscape
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  description TEXT,                 -- 2-3 sentence overview
  image_path TEXT,                  -- path in plant-library bucket
  -- Plant-specific fields (NULL for hardscape)
  zone_min TEXT,                    -- e.g. "3a"
  zone_max TEXT,                    -- e.g. "8b"
  height_min_ft NUMERIC,
  height_max_ft NUMERIC,
  spread_min_ft NUMERIC,
  spread_max_ft NUMERIC,
  sun_requirement TEXT,             -- 'full_sun', 'partial_sun', 'partial_shade', 'full_shade'
  water_needs TEXT,                 -- 'low', 'moderate', 'high'
  growth_rate TEXT,                 -- 'slow', 'moderate', 'fast'
  maintenance_level TEXT,           -- 'low', 'moderate', 'high'
  foliage_type TEXT,                -- 'deciduous', 'evergreen', 'semi-evergreen'
  bloom_season TEXT[],              -- {'spring','summer','fall'}
  flower_colors TEXT[],
  foliage_colors TEXT[],
  drought_tolerant BOOLEAN DEFAULT false,
  deer_resistant BOOLEAN DEFAULT false,
  attracts_pollinators BOOLEAN DEFAULT false,
  native_regions TEXT[],
  toxic_to_pets BOOLEAN DEFAULT false,
  -- Hardscape-specific fields (NULL for plants)
  material_type TEXT,               -- 'natural_stone', 'manufactured', 'metal', 'wood', 'composite'
  color_options TEXT[],
  -- Common fields
  design_styles TEXT[],             -- matching style preset IDs
  common_uses TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for filtering
CREATE INDEX idx_library_items_type ON public.library_items(item_type);
CREATE INDEX idx_library_items_category ON public.library_items(category);
CREATE INDEX idx_library_items_zone ON public.library_items(zone_min, zone_max);

-- RLS: public read access (reference data)
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Library items are publicly readable"
  ON public.library_items FOR SELECT USING (true);

ALTER TABLE public.zip_to_zone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Zip to zone is publicly readable"
  ON public.zip_to_zone FOR SELECT USING (true);

-- Public storage bucket for library images (no signed URLs needed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-library', 'plant-library', true);
```

### 1B. TypeScript types

**File:** `src/types/index.ts`

Add `LibraryItem` interface with all columns. Update `Project` to include `zip_code: string | null` and `hardiness_zone: string | null`.

---

## Phase 2: Seed Data

### 2A. Plant & Hardscape data (~550 items)

**File:** `scripts/seed-library-data.ts`

**Plant categories (~500):**

| Category | Subcategories | ~Count |
|---|---|---|
| Trees | Shade, Ornamental, Evergreen, Fruit | 110 |
| Shrubs | Flowering, Evergreen, Deciduous | 85 |
| Perennials | Flowering, Foliage, Bulbs | 95 |
| Annuals | Flowering, Foliage | 45 |
| Groundcovers | Spreading, Mat-forming | 35 |
| Ornamental Grasses | Cool-season, Warm-season | 35 |
| Vines & Climbers | Flowering, Evergreen | 25 |
| Succulents & Cacti | Succulents, Cacti | 35 |

**Hardscape categories (~50):**

| Subcategory | Examples | ~Count |
|---|---|---|
| Stone | Flagstone, bluestone, limestone, slate, fieldstone, river rock | 6 |
| Gravel & Aggregate | Pea gravel, crushed granite, decomposed granite, river gravel, marble chips | 5 |
| Pavers | Brick, concrete, travertine, porcelain, cobblestone | 5 |
| Retaining Walls | Natural stone, block, timber, gabion | 4 |
| Water Features | Tiered fountain, wall fountain, pond, waterfall, birdbath, bubbler | 6 |
| Fire Features | Stone fire pit, metal fire pit, outdoor fireplace, fire table | 4 |
| Structures | Pergola, arbor, gazebo, trellis, shade sail | 5 |
| Edging | Steel, stone, brick, timber, aluminum | 5 |
| Outdoor Lighting | Path lights, uplights, string lights, bollards, step lights, spotlights | 6 |
| Decorative | Garden bench, planter/urn, stepping stones, statuary, obelisk | 5 |

Hardscape items have `zone_min = NULL`, `zone_max = NULL` (zone-agnostic — always shown).

### 2B. Zip-to-zone lookup

**File:** `scripts/seed-zip-zones.ts`

Source from the Frostline project (waldoj/frostline on GitHub). Bulk-insert ~42K rows.

### 2C. Image generation

**File:** `scripts/generate-library-images.ts`

- Generates 500x500 images via Gemini for each item
- Plants: "Professional nursery catalog photograph of {name} ({scientific_name}), isolated on pure white background, showing full mature form, 500x500"
- Hardscape: "Professional product photograph of {name}, isolated on pure white background, showing texture and material detail, 500x500"
- Uploads to `plant-library` bucket at `{category}/{id}.webp`
- Rate-limited, resumable (skips items with existing image_path)
- **Estimated cost:** ~$17-22 for 500 images at 512px

---

## Phase 3: Project Zone Selection

### 3A. Project creation form

**File:** `src/components/projects/project-list.tsx`

Add optional zip code input below project name. On 5-digit input, auto-lookup zone from `zip_to_zone` table and display as badge ("Zone 7a"). Pass `zip_code` and `hardiness_zone` to insert.

### 3B. Project detail zone display

**File:** `src/components/projects/project-detail.tsx`

Show zone near project header. If unset, prompt "Set your zip code for plant recommendations." Inline edit.

### 3C. Pass zone to generation workspace

**File:** `src/app/(protected)/generate/page.tsx`

Expand project join to `projects(id, name, hardiness_zone)`, pass `hardinessZone` prop to `GenerationWorkspace`.

---

## Phase 4: Plant Browser UI

### 4A. Component architecture

```
src/components/generate/
├── generation-workspace.tsx        (MODIFY)
├── plant-browser.tsx               (NEW — slide-over panel)
├── plant-browser-filters.tsx       (NEW — category tabs + filters + search)
├── plant-browser-card.tsx          (NEW — item card with image)
└── plant-browser-detail.tsx        (NEW — expanded detail view)
```

### 4B. Data fetching

**File:** `src/app/api/library/route.ts` (GET)

Returns all `library_items`. No auth required. Cached 1 hour. Dataset is ~200KB — fetched once on browser open, filtered client-side.

### 4C. Slide-over panel

**File:** `src/components/generate/plant-browser.tsx`

- Right-side panel, 480px wide (full-width on mobile)
- Semi-transparent backdrop
- Sticky header: title, zone badge, close button
- Search bar
- Category tabs: All | Trees | Shrubs | Perennials | Annuals | Grasses | Groundcovers | Vines | Succulents | Hardscape
- Zone toggle: "Show only plants for my zone" (ON by default, OFF to see all)
  - Hidden if project has no zone set
  - Hardscape ALWAYS visible regardless of toggle
- Filter chips (multi-select): Sun, Water, Deer Resistant, Drought Tolerant, Native, Low Maintenance
  - Different filters for Hardscape tab: Material type
- Scrollable card grid

### 4D. Item cards

**File:** `src/components/generate/plant-browser-card.tsx`

- Square image from public bucket
- Common name (bold), scientific name (italic, muted)
- Height range / key dimension
- Sun + water icons
- "+ Add" / checkmark button
- Tap card body → detail view

### 4E. Detail view

**File:** `src/components/generate/plant-browser-detail.tsx`

Inline sub-panel with larger image, full description, all data fields, compatible design styles, "Add to Design" button.

---

## Phase 5: Prompt Integration

### 5A. Selected items in workspace

**File:** `src/components/generate/generation-workspace.tsx`

New state: `selectedLibraryItems: LibraryItem[]`, `browserOpen: boolean`

Between prompt textarea and generate button, render:
- Selected item chips (removable): green-tinted for plants, stone-tinted for hardscape
- "Browse Library" button to open panel

### 5B. Prompt injection

**File:** `src/lib/gemini/prompts.ts`

Update `GenerationParams` to accept `selectedPlants` and `selectedHardscape` arrays.

Update `buildPrompt()`:
```
"Include the following specific plants in the design: Japanese Maple (Acer palmatum), English Lavender (Lavandula angustifolia)."
"Include the following hardscape elements: Flagstone walkway, Stone fire pit."
```

Same for `buildInpaintPrompt()`.

### 5C. API route changes

**Files:** `src/app/api/generate/route.ts`, `src/app/api/generate/inpaint/route.ts`

Accept `selectedPlants` and `selectedHardscape` from request body, pass to prompt builders.

---

## Phase 6: Zone Utility

**File:** `src/lib/utils/zones.ts`

Zone comparison helper for client-side filtering:
- `ZONE_ORDER` array: `['3a','3b','4a','4b',...,'10a','10b']`
- `isZoneInRange(zone, min, max)` — returns boolean
- Used by the plant browser to filter items by project zone

---

## File Summary

### New files (10):
| File | Purpose |
|---|---|
| `supabase/migrations/20260329000001_plant_library.sql` | Migration |
| `scripts/seed-library-data.ts` | Seed ~550 items |
| `scripts/seed-zip-zones.ts` | Seed ~42K zip-to-zone rows |
| `scripts/generate-library-images.ts` | Generate 500x500 images via Gemini |
| `src/app/api/library/route.ts` | GET endpoint for library items |
| `src/components/generate/plant-browser.tsx` | Slide-over browser panel |
| `src/components/generate/plant-browser-filters.tsx` | Filters, search, category tabs |
| `src/components/generate/plant-browser-card.tsx` | Item card |
| `src/components/generate/plant-browser-detail.tsx` | Detail view |
| `src/lib/utils/zones.ts` | Zone comparison utilities |

### Modified files (8):
| File | Change |
|---|---|
| `src/types/index.ts` | Add `LibraryItem`, update `Project` |
| `src/lib/gemini/prompts.ts` | Add selected items to params + prompt injection |
| `src/components/generate/generation-workspace.tsx` | Browser state, chips, browse button |
| `src/components/projects/project-list.tsx` | Zip code input + zone lookup |
| `src/components/projects/project-detail.tsx` | Zone display/edit |
| `src/app/(protected)/generate/page.tsx` | Pass `hardinessZone` prop |
| `src/app/api/generate/route.ts` | Accept + forward selected items |
| `src/app/api/generate/inpaint/route.ts` | Accept + forward selected items |

---

## Implementation Order

1. Migration + types
2. Zip-to-zone seed
3. Project zone selection UI
4. Library data seed
5. Library API route
6. Plant browser UI (slide-over + filters + cards + detail)
7. Selected items chips in workspace
8. Prompt integration
9. Image generation script (can run in parallel with UI work)
10. Testing & polish

---

## Verification

1. Run migration, verify tables with Supabase MCP `list_tables`
2. Seed data, verify counts with `execute_sql`
3. Create project with zip "10001" → resolves to zone "7a"
4. Open plant browser → 9 category tabs work, zone toggle filters correctly
5. Hardscape always visible regardless of zone toggle
6. Select items → chips appear → generate → prompt includes selections
7. `npm run build` passes clean
8. Test mobile responsiveness of browser panel
