"use client";

import type { LibraryItem } from "@/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface PlantBrowserCardProps {
  item: LibraryItem;
  selected: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
}

function SunIcon({ requirement }: { requirement: string | null }) {
  if (!requirement) return null;
  const label =
    requirement === "full_sun"
      ? "Full Sun"
      : requirement === "partial_sun"
        ? "Part Sun"
        : requirement === "partial_shade"
          ? "Part Shade"
          : "Full Shade";
  const filled = requirement === "full_sun" || requirement === "partial_sun";
  return (
    <span
      className={`text-xs ${filled ? "text-warning" : "text-muted-foreground"}`}
      title={label}
    >
      <svg className="inline h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
      </svg>
    </span>
  );
}

function WaterIcon({ needs }: { needs: string | null }) {
  if (!needs) return null;
  const drops = needs === "low" ? 1 : needs === "moderate" ? 2 : 3;
  return (
    <span className="text-xs text-blue-500" title={`${needs} water`}>
      {"💧".repeat(drops)}
    </span>
  );
}

export function PlantBrowserCard({
  item,
  selected,
  onToggle,
  onViewDetail,
}: PlantBrowserCardProps) {
  const imageUrl = (item.thumbnail_path || item.image_path)
    ? `${SUPABASE_URL}/storage/v1/object/public/plant-library/${item.thumbnail_path || item.image_path}`
    : null;

  const heightText =
    item.height_min_ft != null && item.height_max_ft != null
      ? item.height_min_ft === item.height_max_ft
        ? `${item.height_min_ft}ft`
        : `${item.height_min_ft}–${item.height_max_ft}ft`
      : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-background transition-shadow hover:shadow-sm">
      {/* Card body — tap opens detail */}
      <button
        type="button"
        onClick={onViewDetail}
        className="block w-full text-left"
      >
        {/* Image */}
        <div className="aspect-square bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.common_name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-muted text-muted-foreground/60">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wide">No pic yet</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2">
          <p className="truncate text-sm font-medium text-foreground">
            {item.common_name}
          </p>
          {item.scientific_name && (
            <p className="truncate text-xs italic text-muted-foreground">
              {item.scientific_name}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2">
            {heightText && (
              <span className="text-xs text-muted-foreground">{heightText}</span>
            )}
            <SunIcon requirement={item.sun_requirement} />
            <WaterIcon needs={item.water_needs} />
          </div>
        </div>
      </button>

      {/* Add/Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-all ${
          selected
            ? "bg-primary text-white"
            : "bg-background/90 text-muted-foreground opacity-0 shadow-sm hover:text-primary group-hover:opacity-100"
        }`}
        title={selected ? "Remove" : "Add to design"}
      >
        {selected ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        )}
      </button>
    </div>
  );
}
