"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useInViewPlaying() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => el.classList.toggle("playing", e.isIntersecting));
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/**
 * "Homeowner DIY" visual — a looping phone-app mock. The uploaded yard
 * cross-fades through two styled designs as the matching style chip is
 * tapped (tap ripple), with a generate shimmer; feature pills float
 * alongside the gently-bobbing phone. Frozen under reduced-motion (CSS).
 */
function DiyVisual() {
  const ref = useInViewPlaying();
  return (
    <div className="aud-visual diymock" ref={ref} aria-hidden="true">
      <div className="diymock-stage">
      <div className="diymock-pill diymock-pill--a">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6" />
        </svg>
        Zone-matched library
      </div>
      <div className="diymock-pill diymock-pill--b">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.6v6.8a1 1 0 0 1-1.45.9L15 14" />
          <rect x="3" y="6" width="12" height="12" rx="2" />
        </svg>
        Share a reveal video
      </div>

      <div className="diymock-phone">
        <div className="diymock-screen">
          <div className="diymock-bar">
            <span className="diymock-chevron">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </span>
            <span className="diymock-title">My backyard</span>
            <span className="diymock-cred">◆ 3</span>
          </div>
          <div className="diymock-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="diymock-base" src="/landing/lp-house-before.webp" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="diymock-design" data-i="0" src="/landing/lp-house-intermediate.webp" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="diymock-design" data-i="1" src="/landing/lp-house-premium.webp" alt="" />
            <div className="diymock-shimmer" />
          </div>
          <div className="diymock-styles">
            <span className="diymock-style" data-i="0">
              Cottage
              <span className="diymock-tap" data-i="0" />
            </span>
            <span className="diymock-style" data-i="1">
              Modern
              <span className="diymock-tap" data-i="1" />
            </span>
            <button className="diymock-gen" type="button" tabIndex={-1}>
              Generate
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * "Landscape Pro" visual — a looping desktop dashboard mock. Four style
 * renders of the same address generate in parallel (tiles pop in), the main
 * preview cross-fades through them as each is selected (active tile ringed),
 * and a read-only share link is copied. Frozen under reduced-motion (CSS).
 */
function ProVisual() {
  const ref = useInViewPlaying();
  const TILES = [
    { i: "0", src: "/landing/lp-house-budget.webp", label: "Cottage" },
    { i: "1", src: "/landing/lp-house-intermediate.webp", label: "Modern" },
    { i: "2", src: "/landing/lp-house-premium.webp", label: "Premium" },
    { i: "3", src: "/landing/lp-house-edited.webp", label: "Minimal" },
  ];
  return (
    <div className="aud-visual promock" ref={ref} aria-hidden="true">
      <div className="promock-win">
        <div className="promock-head">
          <span className="promock-brand">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            </svg>
          </span>
          <span className="promock-proj">Maple Street · Backyard</span>
          <span className="promock-zone">USDA 6b</span>
          <button className="promock-share" type="button" tabIndex={-1}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
              <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
            </svg>
            Share
          </button>
        </div>
        <div className="promock-body">
          <div className="promock-main">
            {TILES.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={t.i}
                className="promock-render"
                data-i={t.i}
                src={t.src}
                alt=""
              />
            ))}
            <div className="promock-shimmer" />
            <div className="promock-toast">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Read-only link copied
            </div>
          </div>
          <div className="promock-side">
            <div className="promock-sidehead">4 styles · parallel</div>
            {TILES.map((t) => (
              <span
                key={t.i}
                className="promock-tile"
                data-i={t.i}
                style={{ backgroundImage: `url(${t.src})` }}
              >
                <span className="promock-tilelabel">{t.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingAudience() {
  const [pick, setPick] = useState<"diy" | "pro">("pro");

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
          <DiyVisual />
        </div>
        <div className={`aud-panel${pick === "pro" ? " is-active" : ""}`}>
          <div className="ap-copy">
            <div className="ap-eyebrow">For landscape professionals</div>
            <h3>Win the bid, then run the whole job.</h3>
            <p className="lede">
              Close warmer with photo-real AI designs — then handle estimates,
              payments, scheduling, and your crew without ever leaving
              Landscaip.
            </p>
            <ul>
              <li>
                Win more bids with photo-real AI designs in seconds
              </li>
              <li>
                Auto-build an itemized, priced estimate from the design
              </li>
              <li>
                Get e-signed approval and a deposit paid online
              </li>
              <li>
                Schedule the crew, track time, and invoice — all in one place
              </li>
              <li>
                Text &amp; email clients from your own business number
              </li>
              <li>
                Replace your CRM, invoicing, scheduling &amp; design tools with
                one login
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
          <ProVisual />
        </div>
      </div>
    </section>
  );
}
