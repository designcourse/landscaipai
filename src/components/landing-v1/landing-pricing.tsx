"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CREDIT_PACKS } from "@/lib/stripe/config";
import { createClient } from "@/lib/supabase/client";
import { usePurchaseCredits } from "@/components/billing/purchase-credits-modal-context";
import { useAuthModal } from "@/components/shared/auth-modal-context";

export function LandingPricing() {
  const router = useRouter();
  const { open: openCredits } = usePurchaseCredits();
  const { openModal } = useAuthModal();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Detect signed-in state so we can route the CTA to either checkout (modal)
  // or signup (auth modal). We don't await this on first paint — anonymous
  // visitors hit the auth flow either way.
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

  function handleBuyCredits() {
    if (authed) {
      openCredits();
    } else {
      // Not signed in — kick off signup; user can return to the modal after.
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
          3 free designs on signup. After that, buy credits in any size — they
          never expire.
        </p>
      </div>

      <div className="pricing-grid pricing-grid-2col">
        {/* Free tier */}
        <div className="price-card reveal">
          <div className="tier">Starter</div>
          <div className="price">
            <span className="num">$0</span>
            <span className="per">/forever</span>
          </div>
          <p className="blurb">
            For one-yard redesigns and trying the tool.
          </p>
          <ul>
            <li>3 design generations on signup</li>
            <li>Full 400+ species library</li>
            <li>In-painting + style presets</li>
            <li>Shareable project links</li>
          </ul>
          <Link href="/signup" className="btn btn-outline btn-lg">
            Start free
          </Link>
        </div>

        {/* Credit packs */}
        <div className="price-card feat reveal" data-delay="1">
          <span className="price-tag">Most popular</span>
          <div className="tier">Credit packs</div>
          <div className="price">
            <span className="num">$15+</span>
            <span className="per">one-time</span>
          </div>
          <p className="blurb">
            Pay only for what you use. Credits never expire.
          </p>

          <div className="pack-pills">
            {CREDIT_PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={handleBuyCredits}
                className="pack-pill"
              >
                <span className="pack-pill-price">
                  ${p.priceCents / 100}
                </span>
                <span className="pack-pill-credits">
                  {p.credits} credits
                </span>
              </button>
            ))}
          </div>

          <ul>
            <li>~1 credit per design generation</li>
            <li>8&ndash;32 credits per cinematic Veo video</li>
            <li>Volume discount up to 17% off</li>
            <li>Credits never expire</li>
          </ul>

          <button
            type="button"
            onClick={handleBuyCredits}
            className="btn btn-primary btn-lg"
          >
            {authed ? "Buy credits" : "Sign up to buy"}
          </button>
        </div>
      </div>

      {/* Custom styling for the 2-column variant + pack pills.
          Scoped via .pricing-grid-2col so the existing 3-col rules elsewhere
          aren't disturbed. */}
      <style jsx>{`
        :global(.landing-root .pricing-grid-2col) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 880px;
        }
        :global(.landing-root .pricing-grid-2col .pack-pills) {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 22px;
        }
        :global(.landing-root .pricing-grid-2col .pack-pill) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 12px 10px;
          border-radius: 12px;
          border: 1px solid #e5dfd0;
          background: #fbf7ef;
          color: var(--ls-fg, #171717);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
          font: inherit;
        }
        :global(.landing-root .pricing-grid-2col .pack-pill:hover) {
          border-color: var(--ls-primary, #0f8000);
          background: #f3efe1;
          transform: translateY(-1px);
        }
        :global(.landing-root .pricing-grid-2col .pack-pill-price) {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--ls-primary, #0f8000);
          line-height: 1;
        }
        :global(.landing-root .pricing-grid-2col .pack-pill-credits) {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ls-muted-fg, #737373);
        }
        @media (max-width: 720px) {
          :global(.landing-root .pricing-grid-2col) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
