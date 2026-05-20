const FAQS = [
  {
    q: "Is it really free to try?",
    a: "Yes. Three full design generations on signup, no credit card required. After that, buy credit packs in any size — credits never expire.",
    open: true,
  },
  {
    q: "Does my house get distorted in the render?",
    a: "The model is prompted to preserve structural elements — siding, windows, doors, driveway, fence line — and only modify vegetation, hardscape, and ground cover. Results may vary; always sanity-check before acting on a design.",
    delay: 1,
  },
  {
    q: "Will the plants actually grow where I live?",
    a: "We filter the plant library by USDA hardiness zone. Set your ZIP code or zone once in the project menu and the library only shows plants suited to your zone.",
    delay: 2,
  },
  {
    q: "Can I use this for a condo, townhouse, or rental?",
    a: "Yes. Any photo of an outdoor space works — balcony, courtyard, patio, or a single raised bed.",
  },
  {
    q: "Do you store my photos?",
    a: "Your uploads and renderings are stored privately in your account so you can return to them later. Delete any photo or generation from its hover menu in the editor, or delete your account entirely from Account settings.",
    delay: 1,
  },
  {
    q: "Do I need to know plant names?",
    a: "No. Browse the library by category (trees, shrubs, perennials, groundcover, succulents, edibles, ornamental grasses, hardscape) and select what you like. Common and Latin names are shown when available.",
    delay: 2,
  },
  {
    q: "Can I use renders in a commercial client proposal?",
    a: "Yes. You own the renderings the Service produces from your photos and can use them for personal or commercial purposes — see the Terms of Service for full details.",
  },
  {
    q: "How do I cancel?",
    a: "Credit packs are one-time purchases — there's nothing to cancel. To delete your account, email support@landscaip.co from the address on file.",
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
