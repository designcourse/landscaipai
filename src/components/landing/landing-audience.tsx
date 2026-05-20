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
            <h3>Design your yard on the couch.</h3>
            <p className="lede">
              See what your yard could look like before you spend a dollar at
              the nursery — or hire anyone.
            </p>
            <ul>
              <li>
                Zone-matched plant library — set your USDA hardiness zone once
              </li>
              <li>
                16 style presets plus custom prompts for anything in between
              </li>
              <li>
                In-paint specific areas — swap a single tree, change one bed
              </li>
              <li>
                Generate a transformation video to share before you commit
              </li>
            </ul>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-primary btn-lg">
                Try it free
              </Link>
              <Link href="/pricing" className="btn btn-ghost btn-lg">
                See pricing &rarr;
              </Link>
            </div>
          </div>
          <div className="aud-visual" data-label="DIY app · placeholder" />
        </div>
        <div className={`aud-panel${pick === "pro" ? " is-active" : ""}`}>
          <div className="ap-copy">
            <div className="ap-eyebrow">For landscape professionals</div>
            <h3>Show clients a finished yard before you turn a shovel.</h3>
            <p className="lede">
              Render multiple style options from a phone photo in seconds.
              Iterate on-site, share read-only links, close warmer.
            </p>
            <ul>
              <li>
                Generate before/after renders from a phone photo in seconds
              </li>
              <li>
                Multiple styles in parallel — present options side by side
              </li>
              <li>
                Zone-aware plant library so every species is regionally
                appropriate
              </li>
              <li>
                Save projects per address; share with a read-only link
              </li>
              <li>
                Credits-based pricing — no seat fees, no monthly minimum
              </li>
            </ul>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-primary btn-lg">
                Start free
              </Link>
              <Link href="/pricing" className="btn btn-ghost btn-lg">
                See pricing &rarr;
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
