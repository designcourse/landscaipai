"use client";

import { useEffect, useRef, useState } from "react";

interface GalCard {
  style: string;
  filter: string;
  size?: "tall" | "sq" | "wide";
  before: string;
  after: string;
  pill: string;
  meta: string;
  delay?: number;
}

const CARDS: GalCard[] = [
  {
    style: "elevated",
    filter: "modern",
    size: "tall",
    before: "/landing/gal-elevated-before.png",
    after: "/landing/gal-elevated-after.png",
    pill: "Elevated",
    meta: "Modern",
  },
  {
    style: "major",
    filter: "modern",
    size: "sq",
    before: "/landing/gal-major-before.png",
    after: "/landing/gal-major-after.png",
    pill: "Major Enhancement",
    meta: "Modern",
    delay: 1,
  },
  {
    style: "walkway",
    filter: "pool",
    size: "wide",
    before: "/landing/gal-walkway-before.png",
    after: "/landing/gal-walkway-after.png",
    pill: "New Walkway",
    meta: "In-ground Pool",
    delay: 3,
  },
  {
    style: "sidewalk",
    filter: "pool",
    size: "tall",
    before: "/landing/gal-sidewalk-before.png",
    after: "/landing/gal-sidewalk-after.png",
    pill: "New Walkway",
    meta: "In-ground Pool",
    delay: 1,
  },
  {
    style: "wall",
    filter: "child",
    size: "sq",
    before: "/landing/gal-wall-before.png",
    after: "/landing/gal-wall-after.png",
    pill: "Wall Enhancement",
    meta: "Child Friendly",
    delay: 2,
  },
  {
    style: "entertainment",
    filter: "modern",
    before: "/landing/gal-entertain-before.png",
    after: "/landing/gal-entertain-after.png",
    pill: "Entertainment",
    meta: "Modern",
    delay: 2,
  },
  {
    style: "desert",
    filter: "xeriscape",
    size: "wide",
    before: "/landing/gal-desert-before.png",
    after: "/landing/gal-desert-after.png",
    pill: "Desert Xeriscape",
    meta: "Xeriscape",
    delay: 3,
  },
];

const FILTERS = [
  { id: "all", label: "All styles" },
  { id: "cottage", label: "Cottage" },
  { id: "modern", label: "Modern" },
  { id: "zen", label: "Zen" },
  { id: "xeriscape", label: "Xeriscape" },
  { id: "pool", label: "In-ground Pool" },
  { id: "child", label: "Child Friendly" },
];

export function LandingGallery() {
  const [filter, setFilter] = useState("all");
  const layerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLElement>(null);

  // Mouse-driven before/after split per card
  useEffect(() => {
    const cards = galleryRef.current?.querySelectorAll<HTMLDivElement>(
      ".gal-card"
    );
    if (!cards) return;
    const cleanups: Array<() => void> = [];
    cards.forEach((card) => {
      const inner = card.querySelector<HTMLDivElement>(".inner");
      if (!inner) return;
      inner.style.setProperty("--split", "50%");
      const onMove = (e: PointerEvent) => {
        const rect = inner.getBoundingClientRect();
        const pct = Math.max(
          0,
          Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
        );
        inner.style.setProperty("--split", pct.toFixed(2) + "%");
      };
      const onLeave = () => inner.style.setProperty("--split", "50%");
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // Falling leaves animation
  useEffect(() => {
    const layer = layerRef.current;
    const gallery = galleryRef.current;
    if (!layer || !gallery) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const leafSVG =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' +
      '<path d="M50,95 C 35,70 30,45 40,22 C 48,4 60,0 68,8 C 76,18 70,45 62,62 C 55,78 52,87 50,95 Z"/>' +
      '<path d="M50,95 L 50,32" stroke="rgba(0,0,0,.12)" stroke-width="1.2" fill="none"/>' +
      "</svg>";

    const COLORS = ["green", "moss", "olive", "brown", "tan", "clay"];
    const COUNT = 48;
    const leaves: Array<{
      el: HTMLDivElement;
      x0: number;
      y0: number;
      driftSpeed: number;
      scrollBoost: number;
      swayAmp: number;
      swayFreq: number;
      phase: number;
      rot0: number;
      rotSpeed: number;
      size: number;
    }> = [];

    function rnd(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement("div");
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.className = "lf " + color;
      el.innerHTML = leafSVG;
      const sizeRoll = Math.random();
      let size: number;
      if (sizeRoll < 0.45) size = rnd(22, 38);
      else if (sizeRoll < 0.8) size = rnd(38, 62);
      else if (sizeRoll < 0.95) size = rnd(62, 90);
      else size = rnd(90, 120);
      el.style.width = size + "px";
      el.style.height = size + "px";
      layer.appendChild(el);
      leaves.push({
        el,
        x0: rnd(0, 100),
        y0: rnd(-20, 120),
        driftSpeed: rnd(12, 36),
        scrollBoost: rnd(0.4, 1.2),
        swayAmp: rnd(20, 90),
        swayFreq: rnd(0.08, 0.25),
        phase: rnd(0, Math.PI * 2),
        rot0: rnd(-40, 40),
        rotSpeed: rnd(6, 24) * (Math.random() < 0.5 ? -1 : 1),
        size,
      });
    }

    let lastScroll = window.scrollY;
    let scrollAccum = 0;
    const onScroll = () => {
      const now = window.scrollY;
      const dy = now - lastScroll;
      lastScroll = now;
      scrollAccum += Math.abs(dy);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let last = performance.now();
    let raf = 0;
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = gallery!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const wrapH = h + 160;
      leaves.forEach((l) => {
        l.y0 +=
          ((l.driftSpeed * dt + scrollAccum * 0.002 * l.scrollBoost) / h) * 100;
        l.rot0 += l.rotSpeed * dt;
        const yPx = (l.y0 / 100) * h;
        const yWrap = ((yPx % wrapH) + wrapH) % wrapH - 80;
        const sway =
          Math.sin(now * 0.001 * l.swayFreq * Math.PI * 2 + l.phase) *
          l.swayAmp;
        const x = ((l.x0 / 100) * w) + sway - l.size / 2;
        l.el.style.transform = `translate3d(${x.toFixed(1)}px,${yWrap.toFixed(
          1
        )}px,0) rotate(${l.rot0.toFixed(1)}deg)`;
      });
      scrollAccum *= 0.92;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      while (layer.firstChild) layer.removeChild(layer.firstChild);
    };
  }, []);

  return (
    <section className="gallery" id="gallery" ref={galleryRef}>
      <div className="leaf-fall" ref={layerRef} aria-hidden="true" />
      <div className="sec-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          Gallery
        </span>
        <h2 className="sec-title">
          Real yards, redesigned with <em>Landscaip</em>.
        </h2>
        <p className="sec-sub">
          Sample before/after pairs across styles. Hover any card to reveal
          the before.
        </p>
      </div>
      <div className="gallery-filters reveal">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.id}
            className={`gal-chip${filter === f.id ? " is-active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="gal-grid">
        {CARDS.map((c, i) => {
          const visible = filter === "all" || c.filter === filter;
          const sizeClass = c.size ? c.size : "";
          const cls = ["gal-card", sizeClass, "reveal"]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={c.style + i}
              className={cls}
              data-style={c.filter}
              data-delay={c.delay ? String(c.delay) : undefined}
              style={{ display: visible ? undefined : "none" }}
            >
              <div className="inner">
                <div
                  className="ph"
                  style={{ backgroundImage: `url(${c.before})` }}
                />
                <div
                  className="ph after"
                  style={{ backgroundImage: `url(${c.after})` }}
                />
                <div className="divider" />
                <div className="meta">
                  <span className="pill">{c.pill}</span>
                  <span>{c.meta}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
