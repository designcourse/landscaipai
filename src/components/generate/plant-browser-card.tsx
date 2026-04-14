"use client";

import type { LibraryItem } from "@/types";
import { CheckIcon, PlusIcon } from "./plant-browser-icons";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface PlantBrowserCardProps {
  item: LibraryItem;
  selected: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
}

function SunDot({ requirement }: { requirement: string | null }) {
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
      aria-label={label}
      title={label}
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        filled ? "bg-warning" : "bg-panel-input-border"
      }`}
    />
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
      : item.item_type === "hardscape"
        ? "—"
        : null;

  return (
    <div
      className={`group relative flex h-[180px] flex-col overflow-hidden rounded-lg bg-white transition-shadow hover:shadow-sm ${
        selected
          ? "border-2 border-primary"
          : "border border-panel-border-strong"
      }`}
    >
      {/* Body — tap opens detail */}
      <button
        type="button"
        onClick={onViewDetail}
        className="flex flex-1 flex-col text-left"
      >
        {/* Image */}
        <div className="h-[112px] w-full shrink-0 overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.common_name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col px-2.5 pb-2 pt-1.5">
          <p className="truncate text-[11px] font-semibold text-foreground">
            {item.common_name}
          </p>
          {item.scientific_name && (
            <p className="truncate text-[10px] italic text-muted-foreground">
              {item.scientific_name}
            </p>
          )}
          <div className="mt-auto flex items-center gap-1.5">
            {heightText && (
              <span className="text-[10px] font-medium text-foreground/70">
                {heightText}
              </span>
            )}
            <div className="flex-1" />
            <SunDot requirement={item.sun_requirement} />
          </div>
        </div>
      </button>

      {/* Add / Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm shadow-sm transition-all ${
          selected
            ? "bg-primary text-white"
            : "border border-panel-border-strong bg-white text-foreground/70 opacity-0 hover:text-primary group-hover:opacity-100"
        }`}
        title={selected ? "Remove" : "Add to design"}
      >
        {selected ? <CheckIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
