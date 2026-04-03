"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { LibraryItem } from "@/types";
import { isZoneInRange } from "@/lib/utils/zones";
import { PlantBrowserFilters, PLANT_FILTERS, HARDSCAPE_FILTERS } from "./plant-browser-filters";
import { PlantBrowserCard } from "./plant-browser-card";
import { PlantBrowserDetail } from "./plant-browser-detail";
import type { ActiveFilters } from "./plant-browser-filters";

interface PlantBrowserProps {
  hardinessZone: string | null;
  selectedItems: LibraryItem[];
  onSelectionChange: (items: LibraryItem[]) => void;
  onClose: () => void;
  focusItemId?: string | null;
}

export function PlantBrowser({
  hardinessZone,
  selectedItems,
  onSelectionChange,
  onClose,
  focusItemId,
}: PlantBrowserProps) {
  const [allItems, setAllItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(new Set());
  const [zoneFilterEnabled, setZoneFilterEnabled] = useState(!!hardinessZone);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);

  // Fetch all library items on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchItems() {
      try {
        const res = await fetch("/api/library");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!cancelled) {
          setAllItems(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    fetchItems();
    return () => { cancelled = true; };
  }, []);

  // Auto-open detail view when focusItemId is provided
  useEffect(() => {
    if (focusItemId && allItems.length > 0) {
      const item = allItems.find((i) => i.id === focusItemId);
      if (item) setDetailItem(item);
    }
  }, [focusItemId, allItems]);

  const selectedIds = useMemo(
    () => new Set(selectedItems.map((i) => i.id)),
    [selectedItems]
  );

  const toggleItem = useCallback(
    (item: LibraryItem) => {
      if (selectedIds.has(item.id)) {
        onSelectionChange(selectedItems.filter((i) => i.id !== item.id));
      } else {
        onSelectionChange([...selectedItems, item]);
      }
    },
    [selectedIds, selectedItems, onSelectionChange]
  );

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Category filter
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesName = item.common_name.toLowerCase().includes(q);
        const matchesSci = item.scientific_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesSci) return false;
      }

      // Zone filter (only for plants, hardscape always passes)
      if (
        zoneFilterEnabled &&
        hardinessZone &&
        item.item_type === "plant"
      ) {
        if (!isZoneInRange(hardinessZone, item.zone_min, item.zone_max)) {
          return false;
        }
      }

      // Attribute filters
      if (activeFilters.size > 0) {
        const isHardscape = item.item_type === "hardscape";

        if (isHardscape) {
          // Hardscape filters are material_type values
          const materialFilters = [...activeFilters].filter((f) =>
            HARDSCAPE_FILTERS.some((hf) => hf.id === f)
          );
          if (
            materialFilters.length > 0 &&
            !materialFilters.includes(item.material_type ?? "")
          ) {
            return false;
          }
        } else {
          // Plant filters
          for (const filterId of activeFilters) {
            const filterDef = PLANT_FILTERS.find((f) => f.id === filterId);
            if (!filterDef) continue;

            if (filterDef.field === "sun_requirement") {
              if (item.sun_requirement !== filterId) return false;
            } else if (filterDef.field === "water_needs") {
              if (item.water_needs !== filterId) return false;
            } else if (filterDef.field === "maintenance_level") {
              if (item.maintenance_level !== "low") return false;
            } else if (filterDef.field === "deer_resistant") {
              if (!item.deer_resistant) return false;
            } else if (filterDef.field === "drought_tolerant") {
              if (!item.drought_tolerant) return false;
            } else if (filterDef.field === "attracts_pollinators") {
              if (!item.attracts_pollinators) return false;
            }
          }
        }
      }

      return true;
    });
  }, [allItems, activeCategory, search, zoneFilterEnabled, hardinessZone, activeFilters]);

  function handleFilterToggle(filterId: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterId)) {
        next.delete(filterId);
      } else {
        next.add(filterId);
      }
      return next;
    });
  }

  // Clear hardscape-specific filters when switching away from Hardscape, and vice versa
  function handleCategoryChange(category: string) {
    setActiveCategory(category);
    setActiveFilters(new Set());
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (detailItem) {
          setDetailItem(null);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, detailItem]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="flex h-full w-full max-w-[480px] flex-col border-l border-border bg-background shadow-lg">
        {detailItem ? (
          <PlantBrowserDetail
            item={detailItem}
            selected={selectedIds.has(detailItem.id)}
            onToggle={() => toggleItem(detailItem)}
            onBack={() => setDetailItem(null)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Plant & Material Library
                </h2>
                {hardinessZone && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Zone {hardinessZone.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filters */}
            <div className="border-b border-border px-4 py-3">
              <PlantBrowserFilters
                search={search}
                onSearchChange={setSearch}
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
                activeFilters={activeFilters}
                onFilterToggle={handleFilterToggle}
                zoneFilterEnabled={zoneFilterEnabled}
                onZoneFilterToggle={() => setZoneFilterEnabled((v) => !v)}
                hasZone={!!hardinessZone}
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No items match your filters
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveFilters(new Set());
                      setActiveCategory("all");
                    }}
                    className="mt-2 text-sm text-primary transition-colors hover:text-primary-light"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
                    {selectedItems.length > 0 && (
                      <> &middot; {selectedItems.length} selected</>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredItems.map((item) => (
                      <PlantBrowserCard
                        key={item.id}
                        item={item}
                        selected={selectedIds.has(item.id)}
                        onToggle={() => toggleItem(item)}
                        onViewDetail={() => setDetailItem(item)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer with selection count */}
            {selectedItems.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
                >
                  Done ({selectedItems.length} selected)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
