"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { CreditPackSlider } from "@/components/billing/credit-pack-slider";

export default function PricingPage() {
  const { packs } = useCreditPacks();
  const popularIndex = useMemo(() => {
    const idx = packs.findIndex((p) => p.badge === "Most popular");
    return idx >= 0 ? idx : Math.min(1, packs.length - 1);
  }, [packs]);
  const [packIndex, setPackIndex] = useState(0);
  useEffect(() => {
    setPackIndex(popularIndex);
  }, [popularIndex]);
  const selected = packs[Math.min(packIndex, packs.length - 1)] ?? packs[0];

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-5xl px-element py-section">
        <header className="mb-group text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Free to start. Pay only for what you use.
          </h1>
          <p className="mx-auto mt-tight max-w-2xl text-base text-muted-foreground">
            10 free designs on signup. After that, buy credits in any size —
            they never expire.
          </p>
        </header>

        {/* Two-card pricing — Figma Variant A (minimal / editorial) */}
        <section className="grid gap-element lg:grid-cols-2">
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
            <Link
              href="/signup"
              className="mt-group inline-flex h-11 items-center justify-center rounded-md border border-border bg-white text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Start free
            </Link>
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
                {Math.min(...packs.map((p) => p.priceCents / 100))}+
              </span>
              <span className="ml-2 text-base text-muted-foreground">
                / one-time
              </span>
            </div>
            <p className="mt-element text-base text-muted-foreground">
              Pay only for what you use. Credits never expire.
            </p>

            {/* Slider replaces the 4-pack tiles. The slider component itself
                insets the track to its column centers (12.5%/87.5%), so it
                can run full-bleed within the card content area. */}
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
            <Link
              href={`/signup?pack=${selected.id}`}
              className="mt-group inline-flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Sign up to buy
            </Link>
          </div>
        </section>

        {/* Refund policy summary */}
        <section className="mt-section rounded-lg border border-border bg-panel p-element">
          <h2 className="text-lg font-semibold text-foreground">Refund policy</h2>
          <p className="mt-tight text-sm text-muted-foreground">
            Because credits are digital goods that are usable immediately, we
            do not refund credits that have been used. For unused credit
            packs, you can request a refund within{" "}
            <strong className="text-foreground">7 days</strong> of purchase by
            emailing{" "}
            <a
              href="mailto:support@landscaip.co"
              className="text-primary hover:underline"
            >
              support@landscaip.co
            </a>
            . If a generation fails due to a technical fault on our side, the
            credit is automatically refunded to your in-app balance. Full
            details on the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    </main>
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
