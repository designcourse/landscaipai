"use client";

import { CheckIcon } from "./plant-browser-icons";

/**
 * Categories for the left icon rail in the floating plant library.
 * `id` matches LibraryItem.category, or the literal `"all"` for unfiltered.
 */
export const PLANT_CATEGORIES = [
  { id: "all", label: "All", icon: "✦" },
  { id: "Trees", label: "Trees", icon: "🌲" },
  { id: "Shrubs", label: "Shrubs", icon: "🌿" },
  { id: "Perennials", label: "Perennials", icon: "🌸" },
  { id: "Annuals", label: "Annuals", icon: "🌼" },
  { id: "Ornamental Grasses", label: "Grasses", icon: "🌾" },
  { id: "Groundcovers", label: "Covers", icon: "🌱" },
  { id: "Vines & Climbers", label: "Vines", icon: "🍃" },
  { id: "Succulents & Cacti", label: "Succ.", icon: "🌵" },
  { id: "Hardscape", label: "Hardscape", icon: "🪨" },
] as const;

export const PLANT_FILTERS = [
  {
    id: "full_sun",
    label: "Full Sun",
    field: "sun_requirement" as const,
    group: "sunlight" as const,
  },
  {
    id: "partial_sun",
    label: "Part Sun",
    field: "sun_requirement" as const,
    group: "sunlight" as const,
  },
  {
    id: "full_shade",
    label: "Shade",
    field: "sun_requirement" as const,
    group: "sunlight" as const,
  },
  {
    id: "drought_tolerant",
    label: "Drought Tolerant",
    field: "drought_tolerant" as const,
    group: "care" as const,
  },
  {
    id: "low",
    label: "Low Water",
    field: "water_needs" as const,
    group: "care" as const,
  },
  {
    id: "low_maintenance",
    label: "Low Maint.",
    field: "maintenance_level" as const,
    group: "care" as const,
  },
  {
    id: "attracts_pollinators",
    label: "Pollinators",
    field: "attracts_pollinators" as const,
    group: "wildlife" as const,
  },
  {
    id: "deer_resistant",
    label: "Deer Resistant",
    field: "deer_resistant" as const,
    group: "wildlife" as const,
  },
] as const;

export const HARDSCAPE_FILTERS = [
  { id: "natural_stone", label: "Natural Stone", group: "material" as const },
  { id: "manufactured", label: "Manufactured", group: "material" as const },
  { id: "metal", label: "Metal", group: "material" as const },
  { id: "wood", label: "Wood", group: "material" as const },
  { id: "composite", label: "Composite", group: "material" as const },
] as const;

export type ActiveFilters = Set<string>;

type FilterDef = { id: string; label: string; group: string };
function groupByGroup<T extends FilterDef>(defs: readonly T[]) {
  const out: Record<string, { id: string; label: string }[]> = {};
  for (const f of defs) (out[f.group] ??= []).push({ id: f.id, label: f.label });
  return out;
}
const GROUPED_PLANT_FILTERS = groupByGroup(PLANT_FILTERS);
const GROUPED_HARDSCAPE_FILTERS = groupByGroup(HARDSCAPE_FILTERS);

// -------------------------------------------------------------------------
// Category Rail (left column)
// -------------------------------------------------------------------------

interface CategoryRailProps {
  active: string;
  onChange: (id: string) => void;
  counts?: Partial<Record<string, number>>;
}

export function CategoryRail({ active, onChange, counts }: CategoryRailProps) {
  return (
    <nav
      aria-label="Categories"
      className="scrollbar-minimal flex h-full w-16 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-panel-border bg-panel-subtle px-1.5 py-2.5"
    >
      {PLANT_CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        const count = counts?.[cat.id];
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`group flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2 transition-colors ${
              isActive
                ? "bg-primary-tint"
                : "hover:bg-panel-border"
            }`}
            title={cat.id === "all" ? "All items" : cat.id}
          >
            <span
              aria-hidden
              className="text-lg leading-none"
              style={{ fontFamily: "Apple Color Emoji, Segoe UI Emoji, sans-serif" }}
            >
              {cat.icon}
            </span>
            <span
              className={`text-[9px] font-${isActive ? "semibold" : "medium"} leading-tight ${
                isActive ? "text-primary-dark" : "text-muted-foreground"
              }`}
            >
              {cat.label}
            </span>
            {count != null && count > 0 && (
              <span
                className={`text-[9px] leading-none ${
                  isActive ? "text-primary-dark/70" : "text-panel-muted"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// -------------------------------------------------------------------------
// Filter Drawer (right column)
// -------------------------------------------------------------------------

interface FilterDrawerProps {
  isHardscape: boolean;
  activeFilters: ActiveFilters;
  onFilterToggle: (id: string) => void;
  zoneFilterEnabled: boolean;
  onZoneFilterToggle: () => void;
  hasZone: boolean;
  hardinessZone: string | null;
  onReset: () => void;
}

type FilterGroupKey = "sunlight" | "care" | "wildlife" | "material";

const GROUP_LABELS: Record<FilterGroupKey, string> = {
  sunlight: "SUNLIGHT",
  care: "WATER & CARE",
  wildlife: "WILDLIFE",
  material: "MATERIAL",
};

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-2 py-0.5 text-left"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
          checked
            ? "border-primary bg-primary text-white"
            : "border-panel-input-border bg-white"
        }`}
        aria-hidden
      >
        {checked && <CheckIcon className="h-3 w-3" />}
      </span>
      <span
        className={`flex-1 text-xs ${
          checked ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function FilterDrawer({
  isHardscape,
  activeFilters,
  onFilterToggle,
  zoneFilterEnabled,
  onZoneFilterToggle,
  hasZone,
  hardinessZone,
  onReset,
}: FilterDrawerProps) {
  const grouped = isHardscape ? GROUPED_HARDSCAPE_FILTERS : GROUPED_PLANT_FILTERS;
  const hasActive = activeFilters.size > 0 || zoneFilterEnabled;

  return (
    <aside
      aria-label="Filters"
      className="scrollbar-minimal flex h-full w-[220px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-panel-border bg-panel-subtle px-4 py-3.5"
    >
      <div className="flex items-center">
        <h3 className="text-[13px] font-semibold text-foreground">Filters</h3>
        <div className="flex-1" />
        {hasActive && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-semibold text-primary transition-colors hover:text-primary-light"
          >
            Reset
          </button>
        )}
      </div>

      {/* Zone toggle */}
      {hasZone && (
        <button
          type="button"
          onClick={onZoneFilterToggle}
          className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
            zoneFilterEnabled ? "bg-primary-tint" : "bg-panel-border"
          }`}
        >
          <span
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
              zoneFilterEnabled ? "bg-primary" : "bg-panel-input-border"
            }`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                zoneFilterEnabled ? "left-3.5" : "left-0.5"
              }`}
            />
          </span>
          <span
            className={`text-[11px] font-semibold ${
              zoneFilterEnabled ? "text-primary-dark" : "text-muted-foreground"
            }`}
          >
            My zone only
            {hardinessZone ? ` · ${hardinessZone.toUpperCase()}` : ""}
          </span>
        </button>
      )}

      {Object.entries(grouped).map(([group, opts]) => (
        <div key={group} className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {GROUP_LABELS[group as FilterGroupKey] ?? group.toUpperCase()}
          </p>
          {opts.map((opt) => (
            <FilterCheckbox
              key={opt.id}
              label={opt.label}
              checked={activeFilters.has(opt.id)}
              onChange={() => onFilterToggle(opt.id)}
            />
          ))}
        </div>
      ))}

      {!hasZone && (
        <p className="text-[11px] text-muted-foreground">
          Set your project&apos;s zip code to filter by zone.
        </p>
      )}
    </aside>
  );
}
