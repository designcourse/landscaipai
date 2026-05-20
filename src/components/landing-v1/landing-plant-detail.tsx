"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const PLANTS = [
  { id: "cosmos", label: "Cosmos", src: "/landing/lib/detail-cosmos.png" },
  { id: "walnut", label: "Black Walnut", src: "/landing/lib/detail-walnut.png" },
  { id: "jade", label: "Jade Plant", src: "/landing/lib/detail-jade.png" },
];

const ROTATION_MS = 5200;

export function LandingPlantDetail() {
  const [active, setActive] = useState(0);
  const prevRef = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onScreenRef = useRef(false);

  useEffect(() => {
    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        prevRef.current = activeRef.current;
        setActive((i) => (i + 1) % PLANTS.length);
      }, ROTATION_MS);
    };
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          onScreenRef.current = e.isIntersecting;
          if (e.isIntersecting) start();
          else stop();
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  // Track active in a ref so the interval (created on mount only) can reach it.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  function pick(i: number) {
    if (i === active) return;
    prevRef.current = active;
    setActive(i);
    // restart timer on manual pick
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      prevRef.current = activeRef.current;
      setActive((idx) => (idx + 1) % PLANTS.length);
    }, ROTATION_MS);
  }

  return (
    <section className="plant" ref={sectionRef}>
      <div className="plant-grid">
        <div className="plant-stage" aria-label="Plant detail cards">
          <div className="plant-deck">
            {PLANTS.map((p, i) => {
              const cls = [
                "plant-card",
                i === active ? "is-active" : "",
                i === prevRef.current && i !== active ? "is-prev" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <figure key={p.id} className={cls} data-plant={p.id}>
                  <Image
                    src={p.src}
                    alt={`${p.label} plant detail`}
                    width={1000}
                    height={625}
                    sizes="(max-width: 900px) 90vw, 600px"
                  />
                </figure>
              );
            })}
          </div>
          <div className="plant-dots" role="tablist">
            {PLANTS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={p.label}
                className={`plant-dot${i === active ? " is-active" : ""}`}
                onClick={() => pick(i)}
              >
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="plant-copy">
          <span className="lib-eyebrow">
            <span className="dot" />
            Every plant, pre-vetted
          </span>
          <h2 className="lib-title">
            Know what you&apos;re planting <em>before</em> you buy it.
          </h2>
          <p className="plant-lede">
            Every specimen in the library comes with hardiness zones, mature
            size, sun &amp; water needs, toxicity flags, and the style palettes
            it complements — so your yard still works two seasons from now.
          </p>
          <ul className="plant-bullets">
            <li>
              <strong>Regional filters.</strong> Only see plants that thrive in
              your USDA zone.
            </li>
            <li>
              <strong>Companion-aware.</strong> Spot juglone, allelopathy and
              root conflicts before they cost you a tree.
            </li>
            <li>
              <strong>Style-tagged.</strong> Every card tells you which design
              palettes it fits — Modern, Cottage, Japanese Zen.
            </li>
          </ul>
          <div className="plant-cta">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Browse the catalog
            </Link>
            <Link href="/gallery" className="btn btn-ghost btn-lg">
              See a sample species &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
