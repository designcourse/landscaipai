const QUOTES = [
  {
    accent: false,
    quote:
      "I stared at my front yard for six years. Landscaip gave me a plan, a plant list, and a Saturday project. Done in two weekends for under $900.",
    name: "Rachel M.",
    role: "Homeowner · Portland, OR",
  },
  {
    accent: true,
    quote:
      "Our close rate on residential pitches jumped from 28% to 51% once we started showing clients Landscaip renders on the first visit.",
    name: "Julián A.",
    role: "Principal · Arroyo Landscape Studio",
    delay: 1,
  },
  {
    accent: false,
    quote:
      "I use it to stage listings. Showing buyers what the yard *could* be moves houses 11 days faster on average.",
    name: "Karen O.",
    role: "Realtor · Austin, TX",
    delay: 2,
  },
  {
    accent: false,
    quote:
      "The species matching is no joke. I'm in zone 5b and every recommendation overwintered. That has never happened before.",
    name: "David P.",
    role: "Homeowner · Minneapolis, MN",
  },
  {
    accent: false,
    quote:
      "Budget slider saved a commercial bid. Client wanted \u201Clush\u201D on a HOA-capped number. We solved it in the parking lot on my phone.",
    name: "Marcus T.",
    role: "Foreman · Evergreen Commercial",
    delay: 1,
  },
  {
    accent: false,
    quote:
      "Plant list export went straight to my nursery rep. She filled the order without a single callback. Never happens.",
    name: "Priya S.",
    role: "Homeowner · Atlanta, GA",
    delay: 2,
  },
];

export function LandingTestimonials() {
  return (
    <section className="tst" id="testimonials">
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          Loved by
        </span>
        <h2 className="sec-title">
          Homeowners, landscapers, and one <em>very happy realtor</em>.
        </h2>
      </div>
      <div className="tst-grid">
        {QUOTES.map((q, i) => (
          <div
            key={i}
            className={`tst-card${q.accent ? " accent" : ""} reveal`}
            data-delay={q.delay ? String(q.delay) : undefined}
          >
            <q>{q.quote}</q>
            <div className="who">
              <div className="avi" />
              <div>
                <div className="nm">{q.name}</div>
                <div className="role">{q.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
