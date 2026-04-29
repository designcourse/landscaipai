"use client";

import { useEffect, useRef } from "react";

const STEPS = [
  {
    n: "01",
    title: "Upload a photo of your yard",
    body:
      "Any phone photo works. We detect the house, driveway, fence, and existing plants automatically.",
    label: "Upload screen · placeholder",
  },
  {
    n: "02",
    title: "Pick a style, generate a design",
    body:
      "Cottage, Modern, Zen, Xeriscape, plus 2 more. Your house stays pixel-identical — only the landscape changes.",
    label: "Generator · placeholder",
  },
  {
    n: "03",
    title: "Shop the plant list or hand off to a pro",
    body:
      "Every plant in your design is tagged with species, quantity, hardiness zone, and nearest nursery price.",
    label: "Shopping list · placeholder",
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
            No measuring, no plant-naming, no 3-D software. Snap, style, shop.
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
              <div className="step-media" data-label={step.label} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
