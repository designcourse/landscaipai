import Link from "next/link";

export function LandingCTA() {
  return (
    <section className="cta" id="cta">
      <div className="cta-inner">
        <h2 className="reveal">
          Your yard, <em>reimagined</em>.<br />
          Starting with a photo.
        </h2>
        <p className="reveal" data-delay="1">
          Drop an image below. First design takes 45 seconds.
        </p>
        <div className="cta-row reveal" data-delay="2">
          <div className="cta-input">
            <span>Upload a photo of your yard to start</span>
            <span className="cur" />
          </div>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Start free &rarr;
          </Link>
        </div>
        <div className="cta-foot reveal" data-delay="3">
          <span>No credit card</span>
          <span>3 free designs</span>
          <span>45-second first render</span>
        </div>
      </div>
    </section>
  );
}
