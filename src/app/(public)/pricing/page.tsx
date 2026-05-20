import Link from "next/link";
import { CREDIT_PACKS, pricePerCredit, discountPercent } from "@/lib/stripe/config";

export const metadata = {
  title: "Pricing — Landscaip",
  description:
    "Start free, then pay only for what you use. Credits never expire.",
};

export default function PricingPage() {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-5xl px-element py-section">
        <header className="mb-group text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Free to start. Pay only for what you use.
          </h1>
          <p className="mx-auto mt-tight max-w-2xl text-base text-muted-foreground">
            3 free designs on signup. After that, buy credits in any size —
            credits never expire and roughly cover one design generation each.
          </p>
        </header>

        <div className="grid gap-element md:grid-cols-2">
          {/* Free tier */}
          <div className="flex flex-col gap-element rounded-lg border border-border bg-white p-element">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Starter
              </p>
              <div className="mt-tight flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-sm text-muted-foreground">/forever</span>
              </div>
              <p className="mt-tight text-sm text-muted-foreground">
                For one-yard redesigns and trying the tool.
              </p>
            </div>
            <ul className="space-y-1.5 text-sm text-foreground">
              <FeatureLine>3 design generations on signup</FeatureLine>
              <FeatureLine>Full plant &amp; hardscape library (550+ items)</FeatureLine>
              <FeatureLine>In-painting + 16 style presets</FeatureLine>
              <FeatureLine>Shareable project links</FeatureLine>
            </ul>
            <Link
              href="/signup"
              className="mt-auto inline-flex h-11 items-center justify-center rounded-md border border-border bg-white text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Start free
            </Link>
          </div>

          {/* Credit packs */}
          <div
            className="relative flex flex-col gap-element rounded-lg border-2 border-primary bg-white p-element"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            <span className="absolute -top-3 right-element rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
              Most popular
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Credit packs
              </p>
              <div className="mt-tight flex items-baseline gap-1">
                <span className="text-4xl font-bold text-primary">$15+</span>
                <span className="text-sm text-muted-foreground">one-time</span>
              </div>
              <p className="mt-tight text-sm text-muted-foreground">
                Pay only for what you use. Credits never expire.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CREDIT_PACKS.map((pack) => {
                const disc = discountPercent(pack);
                return (
                  <div
                    key={pack.id}
                    className="rounded-md border border-border bg-panel p-3 text-left"
                  >
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-primary">
                        ${pack.priceCents / 100}
                      </span>
                      {disc > 0 && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-dark">
                          −{disc}%
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {pack.credits} credits
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      ${pricePerCredit(pack).toFixed(2)} / credit
                    </div>
                  </div>
                );
              })}
            </div>

            <ul className="space-y-1.5 text-sm text-foreground">
              <FeatureLine>~1 credit per design generation</FeatureLine>
              <FeatureLine>8–32 credits per cinematic video</FeatureLine>
              <FeatureLine>Volume discount up to 17% off</FeatureLine>
              <FeatureLine>Credits never expire</FeatureLine>
            </ul>

            <Link
              href="/signup"
              className="mt-auto inline-flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Sign up to buy
            </Link>
          </div>
        </div>

        {/* Refund policy summary */}
        <section className="mt-section rounded-lg border border-border bg-panel p-element">
          <h2 className="text-lg font-semibold text-foreground">
            Refund policy
          </h2>
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
    <li className="flex items-start gap-2">
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
