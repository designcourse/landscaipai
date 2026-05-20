import Link from "next/link";

export function LandingCTA() {
  return (
    <section className="cta" id="cta">
      <div className="cta-inner">
        <h2 className="reveal">
          Your yard, <em>reimagined</em>.<br />
          Starting with a photo.
        </h2>
        <div className="cta-row reveal" data-delay="1">
          <Link href="/signup" className="btn btn-primary btn-lg">
            Start free &rarr;
          </Link>
        </div>
        <div className="cta-foot reveal" data-delay="2">
          <span>No credit card</span>
          <span>3 free designs</span>
          <span>45-second first render</span>
        </div>
      </div>
    </section>
  );
}
