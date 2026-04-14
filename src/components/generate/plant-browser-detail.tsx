"use client";

import type { LibraryItem } from "@/types";
import { formatZoneRange } from "@/lib/utils/zones";
import { BackIcon } from "./plant-browser-icons";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface PlantBrowserDetailProps {
  item: LibraryItem;
  selected: boolean;
  onToggle: () => void;
  onBack: () => void;
  /** When true, the host panel is wide enough for a 2-column layout. */
  wide?: boolean;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-panel-chip px-2 py-0.5 text-[11px] font-medium text-foreground/70">
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-panel-border py-2 last:border-b-0">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-xs font-semibold text-foreground">
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

function ImageFrame({
  imageUrl,
  name,
  wide,
}: {
  imageUrl: string | null;
  name: string;
  wide: boolean;
}) {
  // In narrow mode the image is centered and capped; in wide mode it fills the column.
  const frame =
    "aspect-square w-full overflow-hidden rounded-lg border-[10px] border-white shadow-sm";
  const sizing = wide ? "" : "mx-auto mb-4 max-w-[280px]";
  if (imageUrl) {
    return (
      <div className={`${frame} bg-muted ${sizing}`}>
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-panel-border text-muted-foreground/50 ${frame} ${sizing}`}
    >
      <svg
        className={wide ? "h-10 w-10" : "h-8 w-8"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
        />
      </svg>
    </div>
  );
}

function Heading({ item }: { item: LibraryItem }) {
  return (
    <>
      <h4 className="text-base font-semibold text-foreground">
        {item.common_name}
      </h4>
      {item.scientific_name && (
        <p className="text-sm italic text-muted-foreground">
          {item.scientific_name}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge>{item.category}</Badge>
        {item.subcategory && <Badge>{item.subcategory}</Badge>}
      </div>
    </>
  );
}

function Traits({ item }: { item: LibraryItem }) {
  if (item.item_type !== "plant") return null;
  const traits: { label: string; tone: "blue" | "green" | "yellow" | "red" }[] = [];
  if (item.drought_tolerant) traits.push({ label: "Drought Tolerant", tone: "blue" });
  if (item.deer_resistant) traits.push({ label: "Deer Resistant", tone: "green" });
  if (item.attracts_pollinators) traits.push({ label: "Attracts Pollinators", tone: "yellow" });
  if (item.toxic_to_pets) traits.push({ label: "Toxic to Pets", tone: "red" });
  if (traits.length === 0) return null;
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {traits.map((t) => (
        <span
          key={t.label}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[t.tone]}`}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function DesignStyles({ item }: { item: LibraryItem }) {
  if (!item.design_styles?.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
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
  );
}

function DetailsTable({ item }: { item: LibraryItem }) {
  const isPlant = item.item_type === "plant";
  return (
    <div className="flex flex-col">
      {isPlant && (
        <>
          <DetailRow label="Hardiness Zones" value={formatZoneRange(item.zone_min, item.zone_max)} />
          <DetailRow label="Height" value={formatHeight(item.height_min_ft, item.height_max_ft)} />
          <DetailRow label="Spread" value={formatHeight(item.spread_min_ft, item.spread_max_ft)} />
          <DetailRow label="Sun" value={formatSun(item.sun_requirement)} />
          <DetailRow
            label="Water"
            value={
              item.water_needs
                ? item.water_needs.charAt(0).toUpperCase() + item.water_needs.slice(1)
                : null
            }
          />
          <DetailRow
            label="Growth Rate"
            value={
              item.growth_rate
                ? item.growth_rate.charAt(0).toUpperCase() + item.growth_rate.slice(1)
                : null
            }
          />
          <DetailRow
            label="Maintenance"
            value={
              item.maintenance_level
                ? item.maintenance_level.charAt(0).toUpperCase() + item.maintenance_level.slice(1)
                : null
            }
          />
          <DetailRow
            label="Foliage"
            value={
              item.foliage_type
                ? item.foliage_type.charAt(0).toUpperCase() + item.foliage_type.slice(1)
                : null
            }
          />
          {item.bloom_season?.length ? (
            <DetailRow
              label="Bloom Season"
              value={item.bloom_season
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join(", ")}
            />
          ) : null}
          {item.flower_colors?.length ? (
            <DetailRow label="Flower Colors" value={item.flower_colors.join(", ")} />
          ) : null}
        </>
      )}

      {!isPlant && item.material_type && (
        <DetailRow
          label="Material"
          value={item.material_type
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())}
        />
      )}
      {!isPlant && item.color_options?.length ? (
        <DetailRow label="Colors" value={item.color_options.join(", ")} />
      ) : null}
    </div>
  );
}

export function PlantBrowserDetail({
  item,
  selected,
  onToggle,
  onBack,
  wide = false,
}: PlantBrowserDetailProps) {
  const imageUrl = item.image_path
    ? `${SUPABASE_URL}/storage/v1/object/public/plant-library/${item.image_path}`
    : null;

  return (
    <div className="flex h-full flex-col bg-panel-subtle">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-panel-border bg-panel-search px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel-subtle hover:text-foreground"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h3 className="flex-1 truncate text-sm font-semibold text-foreground">
          {item.common_name}
        </h3>
      </div>

      {/* Scrollable body */}
      <div className="scrollbar-minimal flex-1 overflow-y-auto px-5 py-5">
        <div
          className={
            wide
              ? "grid grid-cols-[minmax(260px,1fr)_minmax(280px,1.1fr)] gap-6"
              : "flex flex-col"
          }
        >
          <ImageFrame imageUrl={imageUrl} name={item.common_name} wide={wide} />
          <div className={wide ? "flex min-w-0 flex-col" : "mt-4"}>
            <Heading item={item} />
            {item.description && (
              <p className="mt-3 text-sm leading-relaxed text-foreground/80">
                {item.description}
              </p>
            )}
            <Traits item={item} />
            <DesignStyles item={item} />
            <div className="mt-5 rounded-lg border border-panel-border bg-panel px-4 py-1">
              <DetailsTable item={item} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-end border-t border-panel-border bg-panel px-5 py-3">
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-md text-sm font-semibold transition-colors ${
            wide ? "px-4 py-2" : "w-full py-2.5"
          } ${
            selected
              ? "border border-panel-border bg-panel-subtle text-foreground hover:bg-panel-border"
              : "bg-primary text-white hover:bg-primary-light"
          }`}
        >
          {selected ? "Remove from Design" : "Add to Design"}
        </button>
      </div>
    </div>
  );
}
