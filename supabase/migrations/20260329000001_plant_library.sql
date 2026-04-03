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
  scientific_name TEXT,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  description TEXT,
  image_path TEXT,
  zone_min TEXT,
  zone_max TEXT,
  height_min_ft NUMERIC,
  height_max_ft NUMERIC,
  spread_min_ft NUMERIC,
  spread_max_ft NUMERIC,
  sun_requirement TEXT,
  water_needs TEXT,
  growth_rate TEXT,
  maintenance_level TEXT,
  foliage_type TEXT,
  bloom_season TEXT[],
  flower_colors TEXT[],
  foliage_colors TEXT[],
  drought_tolerant BOOLEAN DEFAULT false,
  deer_resistant BOOLEAN DEFAULT false,
  attracts_pollinators BOOLEAN DEFAULT false,
  native_regions TEXT[],
  toxic_to_pets BOOLEAN DEFAULT false,
  material_type TEXT,
  color_options TEXT[],
  design_styles TEXT[],
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

-- Public storage bucket for plant/hardscape reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-library', 'plant-library', true);
