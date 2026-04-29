"use client";

import { useEffect, useRef } from "react";

const ROWS = [
  {
    eyebrow: "Real species, every time",
    title: "400+ species, matched to your conditions.",
    body:
      "We look at your hardiness zone, sun exposure, water access, and soil type — then only recommend species that will actually live there. No painting roses on a cactus lot.",
    stats: [
      { num: "412", lbl: "Species" },
      { num: "13", lbl: "Zones" },
      { num: "98%", lbl: "1-yr survival" },
    ],
    label: "Species matcher · placeholder",
    reverse: false,
  },
  {
    eyebrow: "Budget-aware",
    title: "Slide the budget, watch the plan adapt.",
    body:
      "Dial from a $500 starter bed to a $20,000 full-yard overhaul. Species, quantities, and layout re-cost in real time against local nursery prices.",
    stats: [
      { num: "$500", lbl: "Starts at" },
      { num: "$20k", lbl: "Max tier" },
      { num: "~4k", lbl: "Nurseries" },
    ],
    label: "Budget slider · placeholder",
    reverse: true,
  },
  {
    eyebrow: "Edit anything",
    title: "Drag-and-drop edits, not just regenerations.",
    body:
      "Move a dogwood three feet left. Swap boxwoods for lavender. Re-size a bed. Every change persists and flows to the shopping list.",
    stats: [
      { num: "1-click", lbl: "Plant swap" },
      { num: "Live", lbl: "Cost update" },
      { num: "Undo", lbl: "Unlimited" },
    ],
    label: "Drag-and-drop editor · placeholder",
    reverse: false,
  },
];

export function LandingFeatures() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const visuals = root.querySelectorAll<HTMLElement>("[data-parallax]");
    function tick() {
      const vh = window.innerHeight;
      visuals.forEach((el) => {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const offset = (vh / 2 - center) * 0.08;
        el.style.setProperty("--parallax", offset.toFixed(1) + "px");
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
    <section className="features" id="features" ref={ref}>
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          Features
        </span>
        <h2 className="sec-title">
          Built on a <em>real</em> plant database.
        </h2>
        <p className="sec-sub">
          We don&apos;t paint generic green shapes into your photo. Every
          rendered plant is a species we can name, price, and source.
        </p>
      </div>
      <div className="feat-stack">
        {ROWS.map((row, i) => (
          <div
            className={`feat-row${row.reverse ? " reverse" : ""} reveal`}
            key={i}
          >
            <div className="feat-copy">
              <span className="sec-eyebrow">
                <span className="dot" />
                {row.eyebrow}
              </span>
              <h3>{row.title}</h3>
              <p>{row.body}</p>
              <div className="stats">
                {row.stats.map((s) => (
                  <div className="stat" key={s.lbl}>
                    <span className="num">{s.num}</span>
                    <span className="lbl">{s.lbl}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="feat-visual" data-parallax data-label={row.label} />
          </div>
        ))}
      </div>
    </section>
  );
}
