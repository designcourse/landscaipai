"use client";

import { useEffect, useMemo, useState } from "react";
import { discountPercent, pricePerCredit } from "@/lib/stripe/config";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { CreditPackSlider } from "./credit-pack-slider";

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

export function PurchaseCreditsModal(props: PurchaseCreditsModalProps) {
  // Mount the inner content only while open so `useCreditPacks()` re-runs on
  // every open — admin pricing overrides propagate without a page reload.
  if (!props.open) return null;
  return <PurchaseCreditsModalInner {...props} />;
}

function PurchaseCreditsModalInner({
  open,
  onClose,
  successUrl,
  cancelUrl,
  title,
  subtitle,
}: PurchaseCreditsModalProps) {
  const { packs } = useCreditPacks();
  const popularIndex = useMemo(() => {
    const idx = packs.findIndex((p) => p.badge === "Most popular");
    return idx >= 0 ? idx : Math.min(1, packs.length - 1);
  }, [packs]);
  const [packIndex, setPackIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack = packs[Math.min(packIndex, packs.length - 1)];
  const perCredit = useMemo(
    () => (pack ? pricePerCredit(pack) : 0),
    [pack]
  );
  const discount = useMemo(
    () => (pack ? discountPercent(pack, packs) : 0),
    [pack, packs]
  );

  // Reset selection + lock body scroll when opening
  useEffect(() => {
    if (!open) return;
    setPackIndex(popularIndex);
    setError(null);
    setSubmitting(false);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open, popularIndex]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, submitting]);

  if (!pack) return null;

  async function handlePurchase() {
    if (submitting || !pack) return;
    setSubmitting(true);
    setError(null);

    try {
      const fallback =
        typeof window !== "undefined" ? window.location.href : "/dashboard";
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

          {/* Slider — insets keep edge labels off the modal sides */}
          <div className="mb-group px-3">
            <CreditPackSlider
              selectedIndex={packIndex}
              onChange={setPackIndex}
              disabled={submitting}
            />
          </div>

          {/* Live readout — price + per-credit + optional savings chip */}
          <div className="mb-group rounded-md bg-white px-element py-element ring-1 ring-border">
            <div className="flex items-baseline justify-between gap-element">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold leading-none tracking-tight text-foreground">
                  ${pack.priceCents / 100}
                </span>
                <span className="text-sm text-muted-foreground">USD</span>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-xl font-bold leading-none tracking-tight text-primary">
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
              <div className="mt-3 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
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
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeOpacity="0.3"
                  />
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
              <>
                Purchase {pack.credits} credits — $
                {(pack.priceCents / 100).toFixed(0)}
              </>
            )}
          </button>

          <p className="mt-element text-center text-xs text-muted-foreground">
            Secure checkout via Stripe. Credits never expire.
          </p>
        </div>
      </div>
    </div>
  );
}
