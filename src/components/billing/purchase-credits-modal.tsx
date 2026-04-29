"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CREDIT_PACKS,
  discountPercent,
  pricePerCredit,
} from "@/lib/stripe/config";

interface PurchaseCreditsModalProps {
  open: boolean;
  onClose: () => void;
  /** Where to redirect on successful purchase. Defaults to current URL. */
  successUrl?: string;
  /** Where to redirect if the user cancels checkout. Defaults to current URL. */
  cancelUrl?: string;
  /** Optional headline override (e.g. "You're out of credits" vs "Buy credits"). */
  title?: string;
  /** Optional subtitle below the headline. */
  subtitle?: string;
}

const DEFAULT_PACK_INDEX = 1; // start on the "Most popular" pack

export function PurchaseCreditsModal({
  open,
  onClose,
  successUrl,
  cancelUrl,
  title,
  subtitle,
}: PurchaseCreditsModalProps) {
  const [packIndex, setPackIndex] = useState(DEFAULT_PACK_INDEX);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack = CREDIT_PACKS[packIndex];
  const perCredit = useMemo(() => pricePerCredit(pack), [pack]);
  const discount = useMemo(() => discountPercent(pack), [pack]);

  // Reset selection + lock body scroll when opening
  useEffect(() => {
    if (!open) return;
    setPackIndex(DEFAULT_PACK_INDEX);
    setError(null);
    setSubmitting(false);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handlePurchase() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const fallback = typeof window !== "undefined" ? window.location.href : "/dashboard";
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          successUrl: successUrl ?? fallback,
          cancelUrl: cancelUrl ?? fallback,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-element"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-credits-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !submitting && onClose()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-background shadow-lg">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="px-section pb-section pt-section">
          {/* Header */}
          <div className="mb-group text-center">
            <h2
              id="purchase-credits-title"
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              {title ?? "Buy credits"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {subtitle ?? "Pay only for what you use. Credits never expire."}
            </p>
          </div>

          {/* Live price + credits readout */}
          <div className="mb-group rounded-lg border border-border bg-white px-element py-element">
            <div className="flex items-baseline justify-between gap-element">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold leading-none tracking-tight text-foreground">
                  ${(pack.priceCents / 100).toFixed(0)}
                </span>
                <span className="text-sm text-muted-foreground">USD</span>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-2xl font-semibold leading-none tracking-tight text-primary">
                    {pack.credits}
                  </span>
                  <span className="text-sm text-muted-foreground">credits</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ${perCredit.toFixed(3)} / credit
                </p>
              </div>
            </div>

            {discount > 0 && (
              <div className="mt-element flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Save {discount}% per credit
                </span>
              </div>
            )}
          </div>

          {/* Slider — 4 snap points */}
          <div className="mb-group">
            <input
              type="range"
              min={0}
              max={CREDIT_PACKS.length - 1}
              step={1}
              value={packIndex}
              onChange={(e) => setPackIndex(Number(e.target.value))}
              aria-label="Credit pack size"
              className="credit-slider w-full"
              disabled={submitting}
              style={{
                background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${
                  CREDIT_PACKS.length <= 1
                    ? 0
                    : (packIndex / (CREDIT_PACKS.length - 1)) * 100
                }%, var(--color-border) ${
                  CREDIT_PACKS.length <= 1
                    ? 0
                    : (packIndex / (CREDIT_PACKS.length - 1)) * 100
                }%, var(--color-border) 100%)`,
              }}
            />
            {/* Tick labels */}
            <div className="mt-tight flex justify-between px-1">
              {CREDIT_PACKS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !submitting && setPackIndex(i)}
                  disabled={submitting}
                  className={`flex flex-col items-center gap-0.5 transition-colors ${
                    i === packIndex
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold leading-none ${
                      i === packIndex ? "text-primary" : ""
                    }`}
                  >
                    ${p.priceCents / 100}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider leading-none">
                    {p.credits}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Pack name + blurb */}
          <div className="mb-element text-center">
            <p className="text-sm font-medium text-foreground">
              {pack.name}
              {pack.badge && (
                <span className="ml-2 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  {pack.badge}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{pack.blurb}</p>
          </div>

          {/* Error */}
          {error && (
            <p className="mb-element text-center text-sm text-destructive">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-element py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-60"
          >
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Redirecting to checkout…
              </>
            ) : (
              <>Purchase {pack.credits} credits — ${(pack.priceCents / 100).toFixed(0)}</>
            )}
          </button>

          <p className="mt-element text-center text-xs text-muted-foreground">
            Secure checkout via Stripe. Credits never expire.
          </p>
        </div>
      </div>

      {/* Slider styling — track + thumb tinted to brand */}
      <style jsx global>{`
        .credit-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 9999px;
          outline: none;
          cursor: pointer;
        }
        .credit-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: var(--color-primary);
          border: 3px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
          cursor: grab;
          transition: transform 0.15s ease;
        }
        .credit-slider::-webkit-slider-thumb:hover {
          transform: scale(1.08);
        }
        .credit-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.04);
        }
        .credit-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: var(--color-primary);
          border: 3px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
          cursor: grab;
        }
        .credit-slider:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
