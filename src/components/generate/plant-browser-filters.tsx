"use client";

const PLANT_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "Trees", label: "Trees" },
  { id: "Shrubs", label: "Shrubs" },
  { id: "Perennials", label: "Perennials" },
  { id: "Annuals", label: "Annuals" },
  { id: "Ornamental Grasses", label: "Grasses" },
  { id: "Groundcovers", label: "Groundcovers" },
  { id: "Vines & Climbers", label: "Vines" },
  { id: "Succulents & Cacti", label: "Succulents" },
  { id: "Hardscape", label: "Hardscape" },
] as const;

const PLANT_FILTERS = [
  { id: "full_sun", label: "Full Sun", field: "sun_requirement" as const },
  { id: "low", label: "Low Water", field: "water_needs" as const },
  { id: "deer_resistant", label: "Deer Resistant", field: "deer_resistant" as const },
  { id: "drought_tolerant", label: "Drought Tolerant", field: "drought_tolerant" as const },
  { id: "attracts_pollinators", label: "Pollinators", field: "attracts_pollinators" as const },
  { id: "low_maintenance", label: "Low Maint.", field: "maintenance_level" as const },
] as const;

const HARDSCAPE_FILTERS = [
  { id: "natural_stone", label: "Natural Stone" },
  { id: "manufactured", label: "Manufactured" },
  { id: "metal", label: "Metal" },
  { id: "wood", label: "Wood" },
  { id: "composite", label: "Composite" },
] as const;

export type ActiveFilters = Set<string>;

interface PlantBrowserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeFilters: ActiveFilters;
  onFilterToggle: (filterId: string) => void;
  zoneFilterEnabled: boolean;
  onZoneFilterToggle: () => void;
  hasZone: boolean;
}

export function PlantBrowserFilters({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  activeFilters,
  onFilterToggle,
  zoneFilterEnabled,
  onZoneFilterToggle,
  hasZone,
}: PlantBrowserFiltersProps) {
  const isHardscape = activeCategory === "Hardscape";
  const filters = isHardscape ? HARDSCAPE_FILTERS : PLANT_FILTERS;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {PLANT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Zone toggle */}
      {hasZone && (
        <label className="flex cursor-pointer items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={zoneFilterEnabled}
            onClick={onZoneFilterToggle}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              zoneFilterEnabled ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                zoneFilterEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-xs text-muted-foreground">
            Show only plants for my zone
          </span>
        </label>
      )}
      {!hasZone && (
        <p className="text-xs text-muted-foreground">
          Set your project&apos;s zip code to filter by zone
        </p>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterToggle(f.id)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilters.has(f.id)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { PLANT_FILTERS, HARDSCAPE_FILTERS };
