"use client";

import type { LibraryItem } from "@/types";
import { formatZoneRange } from "@/lib/utils/zones";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface PlantBrowserDetailProps {
  item: LibraryItem;
  selected: boolean;
  onToggle: () => void;
  onBack: () => void;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function formatSun(s: string | null): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatHeight(min: number | null, max: number | null): string {
  if (min == null || max == null) return "";
  if (min === max) return `${min} ft`;
  return `${min}–${max} ft`;
}

export function PlantBrowserDetail({
  item,
  selected,
  onToggle,
  onBack,
}: PlantBrowserDetailProps) {
  const imageUrl = item.image_path
    ? `${SUPABASE_URL}/storage/v1/object/public/plant-library/${item.image_path}`
    : null;

  const isPlant = item.item_type === "plant";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h3 className="flex-1 truncate text-sm font-semibold text-foreground">
          {item.common_name}
        </h3>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Image */}
        {imageUrl && (
          <div className="mx-auto mb-4 aspect-square w-full max-w-[280px] overflow-hidden rounded-lg bg-muted">
            <img
              src={imageUrl}
              alt={item.common_name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Name + description */}
        <h4 className="text-base font-semibold text-foreground">
          {item.common_name}
        </h4>
        {item.scientific_name && (
          <p className="text-sm italic text-muted-foreground">
            {item.scientific_name}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge>{item.category}</Badge>
          <Badge>{item.subcategory}</Badge>
        </div>
        {item.description && (
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">
            {item.description}
          </p>
        )}

        {/* Details */}
        <div className="mt-4 divide-y divide-border-light">
          {isPlant && (
            <>
              <DetailRow
                label="Hardiness Zones"
                value={formatZoneRange(item.zone_min, item.zone_max)}
              />
              <DetailRow
                label="Height"
                value={formatHeight(item.height_min_ft, item.height_max_ft)}
              />
              <DetailRow
                label="Spread"
                value={formatHeight(item.spread_min_ft, item.spread_max_ft)}
              />
              <DetailRow
                label="Sun"
                value={formatSun(item.sun_requirement)}
              />
              <DetailRow
                label="Water"
                value={item.water_needs ? item.water_needs.charAt(0).toUpperCase() + item.water_needs.slice(1) : null}
              />
              <DetailRow
                label="Growth Rate"
                value={item.growth_rate ? item.growth_rate.charAt(0).toUpperCase() + item.growth_rate.slice(1) : null}
              />
              <DetailRow
                label="Maintenance"
                value={item.maintenance_level ? item.maintenance_level.charAt(0).toUpperCase() + item.maintenance_level.slice(1) : null}
              />
              <DetailRow
                label="Foliage"
                value={item.foliage_type ? item.foliage_type.charAt(0).toUpperCase() + item.foliage_type.slice(1) : null}
              />
              {item.bloom_season?.length ? (
                <DetailRow
                  label="Bloom Season"
                  value={item.bloom_season.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                />
              ) : null}
              {item.flower_colors?.length ? (
                <DetailRow
                  label="Flower Colors"
                  value={item.flower_colors.join(", ")}
                />
              ) : null}
            </>
          )}

          {!isPlant && item.material_type && (
            <DetailRow
              label="Material"
              value={item.material_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            />
          )}
          {!isPlant && item.color_options?.length ? (
            <DetailRow
              label="Colors"
              value={item.color_options.join(", ")}
            />
          ) : null}
        </div>

        {/* Traits */}
        {isPlant && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.drought_tolerant && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                Drought Tolerant
              </span>
            )}
            {item.deer_resistant && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                Deer Resistant
              </span>
            )}
            {item.attracts_pollinators && (
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
                Attracts Pollinators
              </span>
            )}
            {item.toxic_to_pets && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                Toxic to Pets
              </span>
            )}
          </div>
        )}

        {/* Compatible styles */}
        {item.design_styles?.length ? (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Works well with
            </p>
            <div className="flex flex-wrap gap-1">
              {item.design_styles.map((s) => (
                <Badge key={s}>
                  {s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer action */}
      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            selected
              ? "border border-border bg-background text-foreground hover:bg-muted"
              : "bg-primary text-white hover:bg-primary-light"
          }`}
        >
          {selected ? "Remove from Design" : "Add to Design"}
        </button>
      </div>
    </div>
  );
}
