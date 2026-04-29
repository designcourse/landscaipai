"use client";

import { useState } from "react";
import Link from "next/link";

export function LandingAudience() {
  const [pick, setPick] = useState<"diy" | "pro">("diy");

  return (
    <section className="audience" id="audience">
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          For everyone with a yard
        </span>
        <h2 className="sec-title">
          Whether you own it or <em>design it for a living</em>.
        </h2>
      </div>
      <div className="aud-toggle reveal" data-pick={pick}>
        <button
          type="button"
          className={pick === "diy" ? "is-active" : ""}
          onClick={() => setPick("diy")}
        >
          Homeowner DIY
        </button>
        <button
          type="button"
          className={pick === "pro" ? "is-active" : ""}
          onClick={() => setPick("pro")}
        >
          Landscape Pro
        </button>
      </div>
      <div className="aud-stage reveal">
        <div className={`aud-panel${pick === "diy" ? " is-active" : ""}`}>
          <div className="ap-copy">
            <div className="ap-eyebrow">For homeowners</div>
            <h3>Design your yard on the couch. Plant it this weekend.</h3>
            <p className="lede">
              Skip the $4,000 landscape architect. Get a real planting plan
              from a photo, shop it at the nursery down the street.
            </p>
            <ul>
              <li>
                Zone-matched species — your hardiness zone, sun, and soil,
                handled automatically
              </li>
              <li>
                Shoppable plant list with quantities and nearest-nursery price
                check
              </li>
              <li>Seasonal care calendar emailed to you each month</li>
              <li>
                Swap any plant for a drought-tolerant, native, or pet-safe
                alternative
              </li>
              <li>Budget slider — tune the design from $500 to $10,000</li>
            </ul>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-primary btn-lg">
                Try it free
              </Link>
              <Link href="/gallery" className="btn btn-ghost btn-lg">
                See sample plan &rarr;
              </Link>
            </div>
          </div>
          <div className="aud-visual" data-label="DIY app · placeholder" />
        </div>
        <div className={`aud-panel${pick === "pro" ? " is-active" : ""}`}>
          <div className="ap-copy">
            <div className="ap-eyebrow">For landscape professionals</div>
            <h3>Close more clients. Spec jobs in minutes, not days.</h3>
            <p className="lede">
              Generate branded client presentations on-site. Export planting
              schedules, takeoffs, and PDFs that look like you built them in
              CAD.
            </p>
            <ul>
              <li>
                White-label client presentations with your logo and palette
              </li>
              <li>PDF + CAD export with plant legend, quantities, and zones</li>
              <li>Multi-project dashboard for up to 200 active jobs</li>
              <li>Commercial licensing and multi-seat agency plans</li>
              <li>API + Zapier for integration with your CRM or estimator</li>
            </ul>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/contact" className="btn btn-primary btn-lg">
                Book a demo
              </Link>
              <Link href="/pricing" className="btn btn-ghost btn-lg">
                Agency pricing &rarr;
              </Link>
            </div>
          </div>
          <div
            className="aud-visual"
            data-label="Pro dashboard · placeholder"
          />
        </div>
      </div>
    </section>
  );
}
