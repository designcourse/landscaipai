"use client";

import { useMemo, useState } from "react";
import type { CanvasItem } from "./canvas-image-card";

interface MobileVideoFramePickerProps {
  /** All canvas items — picker filters to non-video ready frames internally. */
  items: CanvasItem[];
  /** Pre-fill the start slot with the currently selected image. */
  initialStartId: string | null;
  onCancel: () => void;
  /** Fired when the user has chosen both frames and tapped Continue. */
  onConfirm: (startId: string, endId: string) => void;
}

// Two frames count as "same aspect" if their ratios match within 1% — same
// tolerance the desktop selection-bar uses to enable the video button.
const ASPECT_TOLERANCE = 0.01;

export function MobileVideoFramePicker({
  items,
  initialStartId,
  onCancel,
  onConfirm,
}: MobileVideoFramePickerProps) {
  const eligible = useMemo(
    () =>
      items.filter(
        (i) =>
          i.type !== "video" &&
          i.type !== "finalized_video" &&
          i.status !== "generating" &&
          i.status !== "revealing" &&
          !!i.naturalWidth &&
          !!i.naturalHeight,
      ),
    [items],
  );

  // Validate initialStartId against current eligible list before seeding.
  const seedStart = initialStartId && eligible.some((i) => i.id === initialStartId)
    ? initialStartId
    : null;

  const [startId, setStartId] = useState<string | null>(seedStart);
  const [endId, setEndId] = useState<string | null>(null);
  // Which slot the next tap fills. Once start is set, the natural next action
  // is picking end — so a contextual entry skips straight to that stage.
  const [stage, setStage] = useState<"start" | "end">(seedStart ? "end" : "start");

  const startItem = startId ? eligible.find((i) => i.id === startId) ?? null : null;
  const endItem = endId ? eligible.find((i) => i.id === endId) ?? null : null;
  const startAspect = startItem
    ? startItem.naturalWidth / startItem.naturalHeight
    : null;

  function aspectMatches(item: CanvasItem) {
    if (!startAspect) return true;
    const r = item.naturalWidth / item.naturalHeight;
    return Math.abs(r - startAspect) <= ASPECT_TOLERANCE;
  }

  function handleTap(item: CanvasItem) {
    if (stage === "start") {
      setStartId(item.id);
      // Clear any previously-chosen end that no longer matches the new aspect.
      if (endId) {
        const e = eligible.find((i) => i.id === endId);
        const newAspect = item.naturalWidth / item.naturalHeight;
        if (
          !e ||
          Math.abs(e.naturalWidth / e.naturalHeight - newAspect) > ASPECT_TOLERANCE ||
          e.id === item.id
        ) {
          setEndId(null);
        }
      }
      setStage("end");
      return;
    }
    // stage === "end"
    if (item.id === startId) return; // can't use same frame for both
    if (!aspectMatches(item)) return; // disabled, but defensive
    setEndId(item.id);
  }

  const canContinue = !!startId && !!endId;
  const matchedCount = startAspect
    ? eligible.filter((i) => i.id !== startId && aspectMatches(i)).length
    : eligible.length - (startId ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-md px-3 py-2 text-sm font-medium text-foreground"
        >
          Cancel
        </button>
        <span className="text-sm font-semibold text-foreground">
          {stage === "start" ? "Pick start frame" : "Pick end frame"}
        </span>
        <button
          type="button"
          onClick={() => canContinue && onConfirm(startId!, endId!)}
          disabled={!canContinue}
          className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-40"
        >
          Continue
        </button>
      </div>

      {/* Slot chips */}
      <div className="flex items-stretch gap-2 border-b border-border bg-white px-3 py-2">
        <SlotChip
          label="Start"
          item={startItem}
          active={stage === "start"}
          placeholder="Tap an image"
          onClick={() => setStage("start")}
        />
        <SlotChip
          label="End"
          item={endItem}
          active={stage === "end"}
          placeholder={startId ? "Choose end" : "Pick start first"}
          disabled={!startId}
          onClick={() => startId && setStage("end")}
        />
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {eligible.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Upload or generate an image first.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {eligible.map((item) => {
                const isStart = item.id === startId;
                const isEnd = item.id === endId;
                const matches = stage === "start" ? true : aspectMatches(item);
                const isSelf = stage === "end" && item.id === startId;
                const disabled = !matches || isSelf;

                let borderClass = "border-transparent";
                if (isStart) borderClass = "border-primary";
                else if (isEnd) borderClass = "border-blue-500";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => !disabled && handleTap(item)}
                    disabled={disabled}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition-opacity ${borderClass} ${
                      disabled && !isStart && !isEnd ? "opacity-30" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {isStart && (
                      <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Start
                      </span>
                    )}
                    {isEnd && (
                      <span className="absolute left-1 top-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        End
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {stage === "end" && startAspect && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {matchedCount === 0
                  ? "No other frames match the start frame's aspect ratio yet."
                  : `Showing frames that match the start frame's aspect ratio.`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SlotChip({
  label,
  item,
  active,
  placeholder,
  disabled,
  onClick,
}: {
  label: string;
  item: CanvasItem | null;
  active: boolean;
  placeholder: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center gap-2 rounded-md p-2 text-left transition-colors ${
        active ? "bg-primary/10 ring-1 ring-primary" : "bg-muted"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {item ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-10 w-10 rounded object-cover" />
      ) : (
        <span className="text-xs text-muted-foreground">{placeholder}</span>
      )}
    </button>
  );
}
