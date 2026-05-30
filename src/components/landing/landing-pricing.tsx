"use client";

import { useEffect, useMemo, useState } from "react";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { createClient } from "@/lib/supabase/client";
import { usePurchaseCredits } from "@/components/billing/purchase-credits-modal-context";
import { useAuthModal } from "@/components/shared/auth-modal-context";
import { CreditPackSlider } from "@/components/billing/credit-pack-slider";

export function LandingPricing() {
  const { open: openCredits } = usePurchaseCredits();
  const { openModal } = useAuthModal();
  const { packs } = useCreditPacks();
  const popularIndex = useMemo(() => {
    const idx = packs.findIndex((p) => p.badge === "Most popular");
    return idx >= 0 ? idx : Math.min(1, packs.length - 1);
  }, [packs]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [packIndex, setPackIndex] = useState(0);
  useEffect(() => {
    setPackIndex(popularIndex);
  }, [popularIndex]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  function handleBuy() {
    if (authed) openCredits();
    else openModal("signup");
  }

  function handleStartFree() {
    if (authed) {
      // Already signed in — go straight to the dashboard.
      window.location.href = "/dashboard";
    } else {
      openModal("signup");
    }
  }

  return (
    <section className="pricing" id="pricing">
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          Pricing
        </span>
        <h2 className="sec-title">
          Free to start. <em>Pay only</em> for what you use.
        </h2>
        <p className="sec-sub">
          10 free designs on signup. After that, buy credits in any size — they
          never expire.
        </p>
      </div>

      {/* Two-card pricing — Figma Variant A (minimal / editorial). Styled
          with plain Tailwind so it matches /pricing exactly. */}
      <div className="reveal mx-auto mt-12 grid max-w-5xl gap-element px-element lg:grid-cols-2 lg:px-0">
        {/* Starter card */}
        <div className="flex flex-col rounded-lg border border-border bg-white p-section">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Starter
          </p>
          <div className="mt-element flex items-baseline">
            <span className="text-2xl font-medium text-foreground">$</span>
            <span className="text-5xl font-bold leading-none tracking-tight text-foreground">
              0
            </span>
            <span className="ml-2 text-base text-muted-foreground">/ forever</span>
          </div>
          <p className="mt-element text-base text-muted-foreground">
            For one-yard redesigns and trying the tool.
          </p>
          <div className="my-group h-px bg-border" />
          <ul className="flex-1 space-y-3">
            <FeatureLine>3 design generations on signup</FeatureLine>
            <FeatureLine>Full plant &amp; hardscape library (550+ items)</FeatureLine>
            <FeatureLine>In-painting + 16 style presets</FeatureLine>
            <FeatureLine>Shareable project links</FeatureLine>
          </ul>
          <button
            type="button"
            onClick={handleStartFree}
            className="mt-group inline-flex h-11 items-center justify-center rounded-md border border-border bg-white text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Start free
          </button>
        </div>

        {/* Credit Packs card */}
        <div className="flex flex-col rounded-lg border border-border bg-white p-section">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Credit packs
            </p>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-foreground">
              Most popular
            </p>
          </div>
          <div className="mt-element flex items-baseline">
            <span className="text-2xl font-medium text-foreground">$</span>
            <span className="text-5xl font-bold leading-none tracking-tight text-foreground">
              {packs.length > 0
                ? `${Math.min(...packs.map((p) => p.priceCents / 100))}+`
                : "—"}
            </span>
            <span className="ml-2 text-base text-muted-foreground">/ one-time</span>
          </div>
          <p className="mt-element text-base text-muted-foreground">
            Pay only for what you use. Credits never expire.
          </p>

          <div className="mt-group">
            <CreditPackSlider
              selectedIndex={packIndex}
              onChange={setPackIndex}
            />
          </div>

          <div className="my-group h-px bg-border" />
          <ul className="flex-1 space-y-3">
            <FeatureLine>~1 credit per design generation</FeatureLine>
            <FeatureLine>8–32 credits per cinematic Veo video</FeatureLine>
            <FeatureLine>Volume discount up to 17% off</FeatureLine>
            <FeatureLine>Credits never expire</FeatureLine>
          </ul>
          <button
            type="button"
            onClick={handleBuy}
            className="mt-group inline-flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-light"
          >
            Sign up to buy
          </button>
        </div>
      </div>
    </section>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-base text-foreground">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
