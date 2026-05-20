"use client";

import { CREDIT_PACKS } from "@/lib/stripe/config";

interface CreditPackSliderProps {
  selectedIndex: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}

/**
 * Discrete 4-stop slider for credit pack selection.
 *
 * Layout: CSS grid with 4 equal columns. Price labels (top), an overlaid
 * track + dots row (middle), credit labels (bottom). The track inset matches
 * the column centers (12.5% / 87.5%) so the visual thumb always lines up with
 * the column above and below it. Labels are centered within their own 25%
 * column, so they can't overflow the slider edges even for the leftmost or
 * rightmost stop.
 */
export function CreditPackSlider({
  selectedIndex,
  onChange,
  disabled = false,
}: CreditPackSliderProps) {
  const total = CREDIT_PACKS.length;
  const ratio =
    total <= 1 ? 0 : Math.max(0, Math.min(1, selectedIndex / (total - 1)));
  // Filled track spans from the first dot center (12.5%) to the active dot
  // center. Width as a percentage of the overall slider row.
  const filledWidthPct = ratio * 75;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    let next = selectedIndex;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(total - 1, selectedIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(0, selectedIndex - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = total - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next !== selectedIndex) onChange(next);
  }

  const active = CREDIT_PACKS[selectedIndex];

  return (
    <div
      role="slider"
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuenow={selectedIndex}
      aria-valuetext={`$${active.priceCents / 100} — ${active.credits} credits`}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={`select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {/* Price labels row */}
      <div className="grid grid-cols-4">
        {CREDIT_PACKS.map((p, i) => {
          const isActive = i === selectedIndex;
          return (
            <button
              type="button"
              key={`price-${p.id}`}
              onClick={() => !disabled && onChange(i)}
              disabled={disabled}
              tabIndex={-1}
              aria-label={`Select ${p.credits} credits for $${p.priceCents / 100}`}
              className="flex flex-col items-center justify-end px-1 text-center"
            >
              <span
                className={`leading-none transition-all ${
                  isActive
                    ? "text-2xl font-bold text-primary"
                    : "text-base font-semibold text-muted-foreground"
                }`}
              >
                ${p.priceCents / 100}
              </span>
            </button>
          );
        })}
      </div>

      {/* Track + dots row */}
      <div className="relative mt-3 h-8">
        {/* Background track — runs from center of col 0 (12.5%) to center of col 3 (87.5%) */}
        <div className="absolute left-[12.5%] right-[12.5%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        {/* Filled portion */}
        <div
          className="absolute left-[12.5%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-150"
          style={{ width: `${filledWidthPct}%` }}
        />
        {/* Dots overlay — grid keeps each dot centered in its column */}
        <div className="absolute inset-0 grid grid-cols-4">
          {CREDIT_PACKS.map((p, i) => {
            const isActive = i === selectedIndex;
            const isBehind = i < selectedIndex;
            return (
              <button
                key={`dot-${p.id}`}
                type="button"
                onClick={() => !disabled && onChange(i)}
                disabled={disabled}
                tabIndex={-1}
                aria-label={`Select ${p.credits} credits for $${p.priceCents / 100}`}
                className="flex items-center justify-center"
              >
                {isActive ? (
                  <span
                    className="block h-7 w-7 rounded-full border-[3px] border-white bg-primary transition-transform"
                    style={{ boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)" }}
                  />
                ) : isBehind ? (
                  <span className="block h-3.5 w-3.5 rounded-full bg-primary" />
                ) : (
                  <span className="block h-3.5 w-3.5 rounded-full border-2 border-border bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Credit labels row */}
      <div className="mt-3 grid grid-cols-4">
        {CREDIT_PACKS.map((p, i) => {
          const isActive = i === selectedIndex;
          return (
            <div
              key={`credits-${p.id}`}
              className="flex flex-col items-center gap-1 px-1 text-center"
            >
              <span
                className={`leading-none transition-colors ${
                  isActive
                    ? "text-sm font-semibold text-foreground"
                    : "text-xs text-muted-foreground"
                }`}
              >
                {p.credits} credits
              </span>
              {isActive && p.badge && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {p.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
