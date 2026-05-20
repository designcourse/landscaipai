"use client";

import Link from "next/link";
import { useState } from "react";
import { CREDIT_PACKS } from "@/lib/stripe/config";
import { CreditPackSlider } from "@/components/billing/credit-pack-slider";

const POPULAR_INDEX = Math.max(
  0,
  CREDIT_PACKS.findIndex((p) => p.badge === "Most popular")
);

export default function PricingPage() {
  const [packIndex, setPackIndex] = useState(
    POPULAR_INDEX >= 0 ? POPULAR_INDEX : 1
  );
  const selected = CREDIT_PACKS[packIndex];

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-5xl px-element py-section">
        <header className="mb-group text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Free to start. Pay only for what you use.
          </h1>
          <p className="mx-auto mt-tight max-w-2xl text-base text-muted-foreground">
            3 free designs on signup. After that, buy credits in any size —
            they never expire.
          </p>
        </header>

        {/* Unified pricing card — Figma Variant E */}
        <section
          className="overflow-hidden rounded-lg border border-border bg-white"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {/* Body: Starter (left) + Credit packs with slider (right) */}
          <div className="flex flex-col lg:flex-row">
            {/* Starter section */}
            <div className="border-b border-border p-section lg:w-[340px] lg:shrink-0 lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Starter · $0/forever
              </p>
              <p className="mt-element text-base font-semibold text-foreground">
                For one-yard redesigns and trying the tool.
              </p>
              <ul className="mt-element space-y-2.5">
                <FeatureLine>3 design generations on signup</FeatureLine>
                <FeatureLine>Full plant &amp; hardscape library (550+ items)</FeatureLine>
                <FeatureLine>In-painting + 16 style presets</FeatureLine>
                <FeatureLine>Shareable project links</FeatureLine>
              </ul>
            </div>

            {/* Credit packs section */}
            <div className="flex-1 p-section">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Credit packs · $15+ one-time
              </p>
              <p className="mt-element text-base font-semibold text-foreground">
                Pay only for what you use. Credits never expire.
              </p>

              {/* Slider — inset so edge labels stay inside the card */}
              <div className="mt-group px-3">
                <CreditPackSlider
                  selectedIndex={packIndex}
                  onChange={setPackIndex}
                />
              </div>

              <ul className="mt-group space-y-2.5">
                <FeatureLine>~1 credit per design generation</FeatureLine>
                <FeatureLine>8–32 credits per cinematic Veo video</FeatureLine>
                <FeatureLine>Volume discount up to 17% off</FeatureLine>
                <FeatureLine>Credits never expire</FeatureLine>
              </ul>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-tight border-t border-border px-section py-element">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-md border border-primary bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Start free
            </Link>
            <Link
              href={`/signup?pack=${selected.id}`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
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
    <li className="flex items-start gap-2 text-sm text-foreground">
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
