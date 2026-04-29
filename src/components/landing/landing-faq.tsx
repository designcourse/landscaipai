const FAQS = [
  {
    q: "Is it really free to try?",
    a: "Yes. Three full designs, no credit card. You keep the designs and the plant list forever — exports carry a small watermark until you upgrade.",
    open: true,
  },
  {
    q: "Does my house get distorted in the render?",
    a: "No. The model is trained to freeze every structural element — siding, windows, driveway, fence line — and only alter vegetation, hardscape, and ground cover.",
    delay: 1,
  },
  {
    q: "Will the plants actually grow where I live?",
    a: "We use your address to pull USDA hardiness zone, first/last frost dates, and regional soil type. Every recommended species is filtered against those three constraints before it ever shows up in your design.",
    delay: 2,
  },
  {
    q: "Can I use this for a condo, townhouse, or rental?",
    a: "Absolutely. Any photo of outdoor space works — balcony, courtyard, patio, or a single raised bed.",
  },
  {
    q: "Do you store my photos?",
    a: "Only on your account and only so you can return to your designs later. You can delete any photo from Settings → Data; it's permanently removed within 24 hours.",
    delay: 1,
  },
  {
    q: "Do I need to know plant names?",
    a: "No. Browse by style, color, season, or vibe. We'll surface the Latin names if you want them — and hide them if you don't.",
    delay: 2,
  },
  {
    q: "Can I use renders in a commercial client proposal?",
    a: "On Agency plans, yes — renders, PDFs, and CAD exports ship white-labeled with your branding and are licensed for commercial use.",
  },
  {
    q: "How do I cancel?",
    a: "One click in Settings → Billing. No email, no retention call.",
    delay: 1,
  },
];

export function LandingFAQ() {
  return (
    <section className="faq" id="faq">
      <div className="faq-trees" aria-hidden="true">
        <svg
          className="fl-left"
          viewBox="0 0 280 360"
          preserveAspectRatio="xMidYMax meet"
        >
          <rect x="130" y="230" width="20" height="130" rx="4" />
          <path d="M140,250 C 90,240 55,205 55,160 C 20,150 15,100 55,90 C 45,55 75,25 115,35 C 125,10 165,10 175,35 C 215,25 245,55 235,90 C 275,100 270,150 235,160 C 235,205 200,240 150,250 Z" />
          <rect x="40" y="290" width="14" height="70" rx="3" />
          <path d="M47,310 C 10,305 0,265 25,245 C 15,215 55,200 75,220 C 90,195 130,215 120,245 C 140,260 130,300 95,305 C 95,305 80,315 47,315 Z" />
          <rect x="235" y="320" width="8" height="40" rx="2" />
          <path d="M239,330 C 215,325 210,300 225,295 C 230,280 255,285 255,300 C 268,305 265,325 245,330 Z" />
        </svg>
        <svg
          className="fl-right"
          viewBox="0 0 280 360"
          preserveAspectRatio="xMidYMax meet"
        >
          <rect x="130" y="230" width="20" height="130" rx="4" />
          <path d="M140,250 C 90,240 55,205 55,160 C 20,150 15,100 55,90 C 45,55 75,25 115,35 C 125,10 165,10 175,35 C 215,25 245,55 235,90 C 275,100 270,150 235,160 C 235,205 200,240 150,250 Z" />
          <rect x="40" y="290" width="14" height="70" rx="3" />
          <path d="M47,310 C 10,305 0,265 25,245 C 15,215 55,200 75,220 C 90,195 130,215 120,245 C 140,260 130,300 95,305 C 95,305 80,315 47,315 Z" />
          <rect x="235" y="320" width="8" height="40" rx="2" />
          <path d="M239,330 C 215,325 210,300 225,295 C 230,280 255,285 255,300 C 268,305 265,325 245,330 Z" />
        </svg>
      </div>
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          FAQ
        </span>
        <h2 className="sec-title">The questions we get every day.</h2>
      </div>
      <div className="faq-wrap">
        {FAQS.map((f, i) => (
          <details
            key={i}
            className={`faq-item reveal${f.open ? " open" : ""}`}
            open={f.open}
            data-delay={f.delay ? String(f.delay) : undefined}
          >
            <summary>
              {f.q}
              <span className="plus" aria-hidden="true" />
            </summary>
            <div className="body">{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
