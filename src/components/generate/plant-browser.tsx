"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { LibraryItem } from "@/types";
import { isZoneInRange } from "@/lib/utils/zones";
import {
  CategoryRail,
  FilterDrawer,
  PLANT_FILTERS,
  HARDSCAPE_FILTERS,
  type ActiveFilters,
} from "./plant-browser-filters";
import { PlantBrowserCard } from "./plant-browser-card";
import { PlantBrowserDetail } from "./plant-browser-detail";
import {
  CloseIcon,
  MaximizeIcon,
  SearchIcon,
  SlidersIcon,
  GripIcon,
  ResizeHandleIcon,
} from "./plant-browser-icons";
import { useFloatingPanel } from "@/hooks/use-floating-panel";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface PlantBrowserProps {
  hardinessZone: string | null;
  selectedItems: LibraryItem[];
  onSelectionChange: (items: LibraryItem[]) => void;
  onClose: () => void;
  focusItemId?: string | null;
}

/** Pixel gutters the floating panel respects — keeps it clear of toolbar/bottom bar. */
const TOP_GUTTER = 72; // canvas toolbar height + a little breathing room
const BOTTOM_GUTTER = 110; // canvas bottom bar height + shadow clearance
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 620;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 460;

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
  const [drawerOpen, setDrawerOpen] = useState(true);

  // On phones, the panel becomes a fullscreen takeover — the floating chrome
  // (drag/resize/maximize) doesn't make sense at that size. Default the
  // filter drawer closed on mobile so the grid gets the full viewport width.
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // Floating panel bounds (drag/resize/maximize).
  const {
    bounds,
    maximized,
    dragHandlers,
    resizeHandlers,
    toggleMaximize,
  } = useFloatingPanel({
    storageKey: "plant-browser-bounds-v1",
    initial: (() => {
      if (typeof window === "undefined") {
        return { x: 120, y: TOP_GUTTER + 16, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(DEFAULT_WIDTH, vw - 32);
      const height = Math.min(DEFAULT_HEIGHT, vh - TOP_GUTTER - BOTTOM_GUTTER);
      return {
        x: Math.max(16, Math.round((vw - width) / 2)),
        y: Math.max(TOP_GUTTER, Math.round((vh - height - BOTTOM_GUTTER) / 2) + TOP_GUTTER / 2),
        width,
        height,
      };
    })(),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    topGutter: TOP_GUTTER,
    bottomGutter: BOTTOM_GUTTER,
  });

  // Pagination / infinite scroll.
  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch library once.
  useEffect(() => {
    let cancelled = false;
    async function fetchItems() {
      try {
        const res = await fetch("/api/library", { cache: "no-store" });
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
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-open detail view when focusItemId is provided.
  useEffect(() => {
    if (focusItemId && allItems.length > 0) {
      const item = allItems.find((i) => i.id === focusItemId);
      if (item) setDetailItem(item);
    }
  }, [focusItemId, allItems]);

  // Reset pagination whenever the filtered set could change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [search, activeCategory, activeFilters, zoneFilterEnabled]);

  const selectedIds = useMemo(
    () => new Set(selectedItems.map((i) => i.id)),
    [selectedItems],
  );

  const toggleItem = useCallback(
    (item: LibraryItem) => {
      if (selectedIds.has(item.id)) {
        onSelectionChange(selectedItems.filter((i) => i.id !== item.id));
      } else {
        onSelectionChange([...selectedItems, item]);
        // Close the library after adding — user wants to get back to the
        // canvas to keep designing, not stay in the browse list.
        onClose();
      }
    },
    [selectedIds, selectedItems, onSelectionChange, onClose],
  );

  // Filtered items.
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }

      if (search) {
        const q = search.toLowerCase();
        const matchesName = item.common_name.toLowerCase().includes(q);
        const matchesSci = item.scientific_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesSci) return false;
      }

      if (zoneFilterEnabled && hardinessZone && item.item_type === "plant") {
        if (!isZoneInRange(hardinessZone, item.zone_min, item.zone_max)) {
          return false;
        }
      }

      if (activeFilters.size > 0) {
        const isHardscape = item.item_type === "hardscape";

        if (isHardscape) {
          const materialFilters = [...activeFilters].filter((f) =>
            HARDSCAPE_FILTERS.some((hf) => hf.id === f),
          );
          if (
            materialFilters.length > 0 &&
            !materialFilters.includes(item.material_type ?? "")
          ) {
            return false;
          }
        } else {
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

  // Per-category counts for the rail (all items, not post-filter).
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allItems.length };
    for (const it of allItems) {
      counts[it.category] = (counts[it.category] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  const activeCategoryLabel =
    activeCategory === "all" ? "All items" : activeCategory;

  const handleFilterToggle = useCallback((filterId: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setActiveCategory(category);
    setActiveFilters(new Set());
  }, []);

  // Infinite-scroll: watch the sentinel, bump visibleCount when it appears.
  // `hasMore` is in the deps so the observer re-registers whenever the
  // sentinel appears/disappears — e.g. after a category switch where the
  // visibleCount-reset effect briefly runs *after* this effect has already
  // observed a null target.
  const hasMore = visibleCount < filteredItems.length;
  useEffect(() => {
    if (detailItem) return; // sentinel only exists in grid view
    if (!hasMore) return; // sentinel not rendered
    const root = scrollContainerRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const total = filteredItems.length;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, total));
        }
      },
      { root, rootMargin: "200px" },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [detailItem, hasMore, filteredItems.length]);

  const handleResetFilters = useCallback(() => {
    setActiveFilters(new Set());
    setZoneFilterEnabled(false);
  }, []);

  // Close on Escape (detail first, then panel).
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

  const isHardscape = activeCategory === "Hardscape";
  const totalCount = categoryCounts[activeCategory] ?? 0;
  const activeFilterChips = useMemo(() => {
    const defs = isHardscape ? HARDSCAPE_FILTERS : PLANT_FILTERS;
    const out: { id: string; label: string }[] = [];
    for (const id of activeFilters) {
      const def = defs.find((d) => d.id === id);
      if (def) out.push({ id, label: def.label });
    }
    return out;
  }, [activeFilters, isHardscape]);

  const hasActiveFilters = activeFilters.size > 0 || zoneFilterEnabled;

  const panelStyle: React.CSSProperties = isMobile
    ? { left: 0, top: 0, width: "100vw", height: "100dvh", boxShadow: "none" }
    : {
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        boxShadow: "var(--shadow-toolbar)",
      };

  return (
    <div
      role="dialog"
      aria-label="Plant & Material Library"
      className={`fixed z-40 flex flex-col overflow-hidden bg-white ${
        isMobile ? "" : "rounded-lg border border-panel-border"
      }`}
      style={panelStyle}
    >
      {/* Title bar — draggable on desktop, static on mobile */}
      <div
        className="flex h-[52px] shrink-0 select-none items-center gap-2.5 border-b border-panel-border bg-panel pl-4 pr-2.5"
        style={{ cursor: isMobile || maximized ? "default" : "grab" }}
        {...(isMobile ? {} : dragHandlers)}
      >
        {!isMobile && (
          <span className="text-muted-foreground/60" aria-hidden>
            <GripIcon className="h-3.5 w-3.5" />
          </span>
        )}
        <h2 className="text-[13px] font-semibold text-foreground">
          Plant &amp; Material Library
        </h2>
        {hardinessZone && (
          <span className="hidden items-center gap-1.5 rounded-full border border-panel-border bg-white px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:flex">
            <span className="h-[5px] w-[5px] rounded-full bg-primary" />
            Zone {hardinessZone.toUpperCase()}
          </span>
        )}

        <div className="flex flex-1" />

        {!detailItem && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDrawerOpen((v) => !v);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-panel-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-panel-subtle"
            title={drawerOpen ? "Hide filters" : "Show filters"}
          >
            <SlidersIcon />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-white">
                {activeFilters.size + (zoneFilterEnabled ? 1 : 0)}
              </span>
            )}
          </button>
        )}

        {!isMobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximize();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-panel-subtle hover:text-foreground"
            title={maximized ? "Restore" : "Maximize"}
            aria-label={maximized ? "Restore" : "Maximize"}
          >
            <MaximizeIcon />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-panel-subtle hover:text-foreground"
          title="Close"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      {detailItem ? (
        <div className="flex min-h-0 flex-1 flex-col bg-panel-subtle">
          <PlantBrowserDetail
            item={detailItem}
            selected={selectedIds.has(detailItem.id)}
            onToggle={() => toggleItem(detailItem)}
            onBack={() => setDetailItem(null)}
            wide={bounds.width >= 720}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Category rail */}
          <CategoryRail
            active={activeCategory}
            onChange={handleCategoryChange}
            counts={categoryCounts}
          />

          {/* Main area */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel-main">
            {/* Search */}
            <div className="flex shrink-0 items-center gap-2.5 border-b border-panel-border bg-panel-search px-4 py-3">
              <div className="flex flex-1 items-center gap-2 rounded-md px-3 py-2">
                <SearchIcon className="h-3.5 w-3.5 text-panel-placeholder" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search in ${activeCategoryLabel}...`}
                  className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-panel-placeholder focus:outline-none"
                />
              </div>
            </div>

            {/* Active filter strip */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-panel-border bg-panel-subheader px-4 py-2.5">
              <p className="text-[13px] font-semibold text-muted-foreground">
                {activeCategoryLabel} · {filteredItems.length} of {totalCount}
              </p>
              {(zoneFilterEnabled || activeFilterChips.length > 0) && (
                <>
                  <span className="h-3 w-px bg-panel-input-border" />
                  {zoneFilterEnabled && hardinessZone && (
                    <ActiveChip
                      label={`Zone ${hardinessZone.toUpperCase()}`}
                      onRemove={() => setZoneFilterEnabled(false)}
                    />
                  )}
                  {activeFilterChips.map(({ id, label }) => (
                    <ActiveChip
                      key={id}
                      label={label}
                      onRemove={() => handleFilterToggle(id)}
                    />
                  ))}
                </>
              )}
              <div className="flex-1" />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="cursor-pointer text-[11px] font-semibold text-primary transition-colors hover:text-primary-light"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Results grid */}
            <div
              ref={scrollContainerRef}
              className="scrollbar-minimal min-h-0 flex-1 overflow-y-auto bg-panel-subheader px-4 py-3"
            >
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
                      handleResetFilters();
                      setActiveCategory("all");
                    }}
                    className="mt-2 cursor-pointer text-sm text-primary transition-colors hover:text-primary-light"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="grid gap-2.5"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(130px, 1fr))",
                    }}
                  >
                    {filteredItems.slice(0, visibleCount).map((item) => (
                      <PlantBrowserCard
                        key={item.id}
                        item={item}
                        selected={selectedIds.has(item.id)}
                        onToggle={() => toggleItem(item)}
                        onViewDetail={() => setDetailItem(item)}
                      />
                    ))}
                  </div>
                  {visibleCount < filteredItems.length && (
                    <div
                      ref={sentinelRef}
                      className="flex items-center justify-center py-6 text-[11px] text-muted-foreground"
                    >
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="ml-2">
                        Loading more ({visibleCount} of {filteredItems.length})
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Filter drawer */}
          {drawerOpen && (
            <FilterDrawer
              isHardscape={isHardscape}
              activeFilters={activeFilters}
              onFilterToggle={handleFilterToggle}
              zoneFilterEnabled={zoneFilterEnabled}
              onZoneFilterToggle={() => setZoneFilterEnabled((v) => !v)}
              hasZone={!!hardinessZone}
              hardinessZone={hardinessZone}
              onReset={handleResetFilters}
            />
          )}
        </div>
      )}

      {/* Footer — hidden when a detail view is showing (detail owns its own CTA) */}
      {!detailItem && (
      <div className="flex h-[54px] shrink-0 items-center gap-2.5 border-t border-panel-border bg-panel-subtle px-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium text-panel-muted">
            Selected
          </span>
          {selectedItems.slice(0, 4).map((item) => {
            const url = (item.thumbnail_path || item.image_path)
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-library/${item.thumbnail_path || item.image_path}`
              : null;
            return (
              <span
                key={item.id}
                className="h-[22px] w-[22px] overflow-hidden rounded-[5px] border-2 border-white bg-muted shadow-sm"
                title={item.common_name}
                style={
                  url
                    ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              />
            );
          })}
          {selectedItems.length > 4 && (
            <span className="text-[11px] font-semibold text-panel-muted">
              +{selectedItems.length - 4}
            </span>
          )}
        </div>
        <div className="flex-1" />
        <span className="text-[12px] font-semibold text-panel-muted">
          {selectedItems.length} selected
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={selectedItems.length === 0}
          className="flex h-[30px] cursor-pointer items-center justify-center rounded-md bg-primary px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add to Canvas
        </button>
      </div>
      )}

      {/* Resize handle — desktop only */}
      {!isMobile && !maximized && (
        <button
          type="button"
          aria-label="Resize panel"
          className="absolute bottom-0 right-0 flex h-4 w-4 items-end justify-end p-0.5 text-muted-foreground/60 hover:text-foreground"
          style={{ cursor: "nwse-resize", background: "transparent" }}
          {...resizeHandlers}
        >
          <ResizeHandleIcon />
        </button>
      )}
    </div>
  );
}

function ActiveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-panel-border bg-panel-chip py-0.5 pl-2 pr-1 text-[11px] font-medium text-foreground/80">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full text-foreground/60 transition-colors hover:text-foreground"
        aria-label={`Remove ${label}`}
      >
        <CloseIcon className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
