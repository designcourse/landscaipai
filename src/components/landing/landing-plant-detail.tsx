"use client";

import { useEffect, useRef, useState } from "react";
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
            Every specimen in the library is tagged with its USDA hardiness
            zone range — so when you set your zone, you only see plants that
            will actually live where you live.
          </p>
          <ul className="plant-bullets">
            <li>
              <strong>Zone-filtered.</strong> Set your ZIP or zone once; the
              library hides anything that won&apos;t survive a winter there.
            </li>
            <li>
              <strong>Categorized.</strong> Trees, shrubs, perennials,
              groundcover, ornamental grasses, succulents, edibles, and
              hardscape — eight tabs to narrow what you&apos;re looking at.
            </li>
            <li>
              <strong>Reference, not decoration.</strong> The plants you select
              become part of the prompt the AI uses to render your design.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
