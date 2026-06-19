"use client";

import { useEffect, useRef } from "react";

/**
 * Step 01 media — a looping "upload & generate" mock. The uploaded house
 * photo is shown, custom instructions type out, Generate is clicked, and the
 * photo is turned into three budget-tiered concepts — Budget-Friendly,
 * Intermediate, Premium — each holding the stage for ~3s with a tier label
 * + matching thumbnail. Frozen to the finished state under reduced-motion.
 */
function GenerateMock() {
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

  return (
    <div className="step-media upmock genmock" ref={ref} aria-hidden="true">
      <div className="upmock-head">
        <span className="upmock-eyebrow">
          <span className="dot" />
          Generate
        </span>
        <span className="upmock-step">01 · Concepts</span>
      </div>

      <div className="genmock-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="genmock-before" src="/landing/lp-house-before.webp" alt="" />
        {/* The 3 budget-tier concepts, revealed one at a time (~3s each). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="genmock-after"
          data-i="0"
          src="/landing/lp-house-budget.webp"
          alt=""
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="genmock-after"
          data-i="1"
          src="/landing/lp-house-intermediate.webp"
          alt=""
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="genmock-after"
          data-i="2"
          src="/landing/lp-house-premium.webp"
          alt=""
        />
        <div className="genmock-shimmer" />
        <div className="genmock-genchip">
          <span className="genmock-spark" />
          Generating 3 concepts…
        </div>
        <div className="genmock-count genmock-tier">
          <span data-i="0">Budget-Friendly · $</span>
          <span data-i="1">Intermediate · $$</span>
          <span data-i="2">Premium · $$$</span>
        </div>
        <div className="genmock-results">
          <span
            className="genmock-thumb"
            data-i="0"
            style={{ backgroundImage: "url(/landing/lp-house-budget.webp)" }}
          />
          <span
            className="genmock-thumb"
            data-i="1"
            style={{ backgroundImage: "url(/landing/lp-house-intermediate.webp)" }}
          />
          <span
            className="genmock-thumb"
            data-i="2"
            style={{ backgroundImage: "url(/landing/lp-house-premium.webp)" }}
          />
        </div>
      </div>

      <div className="genmock-controls">
        <div className="genmock-promptrow">
          <div className="genmock-prompt">
            <span className="genmock-typed">improve the landscaping</span>
          </div>
          <button className="genmock-generate" type="button" tabIndex={-1}>
            <span className="genmock-gen-idle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/leaf-mark-white.png" alt="" />
              Generate
            </span>
            <span className="genmock-gen-busy">Generating…</span>
          </button>
        </div>
      </div>

      <div className="genmock-cursor">
        <svg viewBox="0 0 24 24">
          <path
            d="M5 2.5 19 11l-6.1 1.4L9.6 20 5 2.5Z"
            fill="#fff"
            stroke="#1c1c1c"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Step 02 media — a looping "edit / re-prompt" mock. The Premium concept is
 * shown, a follow-up instruction types out ("remove the tree & flowerbed"),
 * a selection highlights the targeted area, Refine is clicked, and a shimmer
 * resolves into the edited result (right-side tree + bed gone) with an
 * "applied" chip and a Premium → Edited label.
 * Reuses the .genmock static styles; .refmock drives its own timeline.
 */
function RefineMock() {
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

  return (
    <div className="step-media upmock refmock" ref={ref} aria-hidden="true">
      <div className="upmock-head">
        <span className="upmock-eyebrow">
          <span className="dot" />
          Refine
        </span>
        <span className="upmock-step">02 · Edit</span>
      </div>

      <div className="genmock-stage refmock-stage">
        {/* Premium concept (the design being edited) … */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="genmock-after refmock-v"
          data-i="0"
          src="/landing/lp-house-premium.webp"
          alt=""
        />
        {/* … and the result after the targeted edit is applied. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="genmock-after refmock-v"
          data-i="1"
          src="/landing/lp-house-edited.webp"
          alt=""
        />
        {/* Selection over the area the prompt targets (right-side tree + bed) */}
        <div className="refmock-mask" />
        <div className="genmock-shimmer refmock-shimmer" />
        <div className="refmock-ver">
          <span data-i="0">Premium</span>
          <span data-i="1">Edited</span>
        </div>
        <div className="refmock-applied">
          <span data-i="0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Tree &amp; flowerbed removed
          </span>
        </div>
      </div>

      <div className="genmock-promptrow refmock-promptrow">
        <div className="genmock-prompt refmock-prompt">
          <span className="refmock-arrow">↳</span>
          <span className="genmock-typed refmock-typed" data-i="0">
            remove the tree &amp; flowerbed
          </span>
        </div>
        <button className="genmock-generate refmock-refine" type="button" tabIndex={-1}>
          <span className="genmock-gen-idle refmock-idle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11a8 8 0 0 1 13.5-5.5L20 8" />
              <path d="M20 3.5V8h-4.5" />
              <path d="M21 13a8 8 0 0 1-13.5 5.5L4 16" />
              <path d="M4 20.5V16h4.5" />
            </svg>
            Refine
          </span>
          <span className="genmock-gen-busy refmock-busy">Refining…</span>
        </button>
      </div>

      <div className="genmock-cursor refmock-cursor">
        <svg viewBox="0 0 24 24">
          <path
            d="M5 2.5 19 11l-6.1 1.4L9.6 20 5 2.5Z"
            fill="#fff"
            stroke="#1c1c1c"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Step 03 media — "optionally generate video" mock. The finished design is
 * turned into a before→after motion clip. The <video> only plays while the
 * mock is on screen. Swap the src for the project's own clip when ready.
 */
function VideoMock() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const video = el.querySelector("video");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          el.classList.toggle("playing", e.isIntersecting);
          if (!video || reduced) return;
          if (e.isIntersecting) video.play().catch(() => {});
          else video.pause();
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="step-media upmock vidmock" ref={ref} aria-hidden="true">
      <div className="upmock-head">
        <span className="upmock-eyebrow">
          <span className="dot" />
          Video
        </span>
        <span className="upmock-step">03 · Video</span>
      </div>

      <div className="genmock-stage vidmock-stage">
        <video
          className="vidmock-video"
          src="/landing/lp-howitworks-video.mp4"
          poster="/landing/lp-house-before.webp"
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="vidmock-chip">
          <span className="vidmock-dot" />
          Before → After
        </div>
      </div>

      <div className="genmock-promptrow vidmock-row">
        <div className="genmock-prompt vidmock-meta">Cinematic flythrough · 10s</div>
        <button className="genmock-generate vidmock-btn" type="button" tabIndex={-1}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.6v6.8a1 1 0 0 1-1.45.9L15 14" />
            <rect x="3" y="6" width="12" height="12" rx="2" />
          </svg>
          Generate video
        </button>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Upload & generate",
    body:
      "Upload any photo of your yard and get three ready-to-build concepts — Budget-Friendly, Intermediate, and Premium.",
    label: "Generator · placeholder",
  },
  {
    n: "02",
    title: "Edit any detail with a prompt",
    body:
      "Re-prompt to change one thing — “remove the tree and flowerbed” — and nothing else moves.",
    label: "Editor · placeholder",
  },
  {
    n: "03",
    title: "Optionally generate video",
    body:
      "Turn any design into a cinematic before-and-after flythrough to share with clients or your group chat.",
    label: "Video · placeholder",
  },
];

export function LandingHowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const stepsEls = list.querySelectorAll<HTMLLIElement>(".how-step");

    function tick() {
      const rect = list!.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height;
      const passed = Math.min(Math.max(vh * 0.6 - rect.top, 0), total);
      const pct = Math.max(0, Math.min(100, (passed / total) * 100));
      list!.style.setProperty("--progress", pct + "%");
      stepsEls.forEach((st) => {
        const r = st.getBoundingClientRect();
        if (r.top < vh * 0.6) st.classList.add("in");
      });
    }
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    tick();
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, []);

  return (
    <section className="how" id="how">
      <div className="how-grid">
        <div className="how-left reveal">
          <span className="sec-eyebrow">
            <span className="dot" />
            How it works
          </span>
          <h2 className="sec-title">
            From phone photo to planted yard, in <em>three steps</em>.
          </h2>
          <p className="sec-sub">
            No measuring, no plant-naming, no 3-D software. Snap, style, refine.
          </p>
        </div>
        <ol className="how-steps" ref={listRef}>
          {STEPS.map((step, i) => (
            <li
              className="how-step reveal"
              key={step.n}
              data-delay={i > 0 ? String(i) : undefined}
            >
              <div className="num">{step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {i === 0 ? (
                <GenerateMock />
              ) : i === 1 ? (
                <RefineMock />
              ) : (
                <VideoMock />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
