const LOGOS = [
  "HGTV",
  "Apartment Therapy",
  "Houzz",
  "Dwell",
  "Fine Gardening",
  "This Old House",
  "Gardenista",
  "Better Homes",
];

export function LandingLogos() {
  const items = [...LOGOS, ...LOGOS];
  return (
    <section className="logos" aria-label="Press and customer logos">
      <div className="logos-head">
        As seen in · trusted by 12,000+ homeowners and 300+ landscape pros
      </div>
      <div className="logos-wrap">
        <div className="logos-track">
          {items.map((label, i) => (
            <span className="logo-item" key={`${label}-${i}`}>
              <span className="glyph" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
