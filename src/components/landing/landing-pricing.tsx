import Link from "next/link";

const TIERS = [
  {
    tier: "Starter",
    price: "$0",
    per: "/forever",
    blurb: "For one-yard redesigns and trying the tool.",
    features: [
      "3 design generations",
      "Full 400+ species library",
      "Shoppable plant list",
      "Watermarked exports",
    ],
    cta: { label: "Start free", href: "/signup", style: "outline" as const },
    feat: false,
  },
  {
    tier: "Pro",
    price: "$19",
    per: "/month",
    blurb: "For serious DIYers tackling a full yard.",
    features: [
      "Unlimited generations",
      "Drag-and-drop plan editor",
      "PDF export without watermark",
      "Seasonal care calendar",
      "Priority support",
    ],
    cta: {
      label: "Start 14-day trial",
      href: "/signup",
      style: "primary" as const,
    },
    feat: true,
    tag: "Most popular",
  },
  {
    tier: "Agency",
    price: "$89",
    per: "/seat/month",
    blurb: "For landscape pros and design studios.",
    features: [
      "Everything in Pro",
      "White-label client presentations",
      "CAD export + takeoffs",
      "Multi-project dashboard",
      "API + Zapier",
      "Dedicated onboarding",
    ],
    cta: {
      label: "Talk to sales",
      href: "/contact",
      style: "outline" as const,
    },
    feat: false,
  },
];

export function LandingPricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          Pricing
        </span>
        <h2 className="sec-title">
          Free to start. <em>Fair</em> at scale.
        </h2>
        <p className="sec-sub">
          No credit card to generate your first 3 designs.
        </p>
      </div>
      <div className="pricing-grid">
        {TIERS.map((t, i) => (
          <div
            key={t.tier}
            className={`price-card${t.feat ? " feat" : ""} reveal`}
            data-delay={i > 0 ? String(i) : undefined}
          >
            {t.feat && t.tag && <span className="price-tag">{t.tag}</span>}
            <div className="tier">{t.tier}</div>
            <div className="price">
              <span className="num">{t.price}</span>
              <span className="per">{t.per}</span>
            </div>
            <p className="blurb">{t.blurb}</p>
            <ul>
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link
              href={t.cta.href}
              className={`btn btn-${t.cta.style} btn-lg`}
            >
              {t.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
